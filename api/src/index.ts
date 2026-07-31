import express, { RequestHandler, Request, Response, NextFunction} from 'express';
import cors, { CorsOptions } from 'cors';
import { MongoClient, ObjectId, AnyBulkWriteOperation, Document } from 'mongodb';
import dotenv from 'dotenv';
import fetch, { RequestInit as FetchRequestInit } from 'node-fetch';
import writeExcelFile from 'write-excel-file/node'
import moment from 'moment-timezone';
import crypto from 'crypto';
import { URL, URLSearchParams } from 'url';
import { requireAdmin } from './middleware/requireadmin';
import { csrfMiddleware} from './middleware/csrfToken';
import escapeStringRegexp from 'escape-string-regexp';
import helmet from 'helmet';
import { promisify } from 'node:util';
import * as limit from "./middleware/rateLimit";
import MongoStore from 'connect-mongo';
import * as sanitise from "./middleware/sanitiseInputs";
import { errorHandler } from './middleware/errorHandle'
import { createEventService } from "./middleware/eventManagement";
import { TTLCache } from "./middleware/simpleCache";
import session from 'express-session';
import { requireRoleAssignmentPin } from './middleware/roleAssignmentPin';

dotenv.config();

const app = express();
const port = process.env.PORT || 8080;
const DB_NAME = process.env.DB_NAME;
const cosmosDbUri = process.env.COSMOS_DB_URI;
const sessionStoreUrl = process.env.SESSION_STORE_URL
const ADMIN_GROUP_ID = process.env.ADMIN_GROUP_ID!;
const FRONTEND_URL = process.env.FRONTEND_URL
const TENANT_ID = process.env.AZURE_TENANT_ID!;
const CLIENT_ID = process.env.AZURE_CLIENT_ID!;
const CLIENT_SECRET = process.env.AZURE_CLIENT_SECRET!;
const REDIRECT_URI = process.env.AZURE_REDIRECT_URI!;
const eventListCache = new TTLCache<any[]>(30_000);
const usernameSearchCache = new TTLCache<string[]>(30_000);
const userNamesCache = new TTLCache<any[]>(5 * 60_000);
const usersListCache = new TTLCache<any[]>(60_000);
const reportUsersCache = new TTLCache<any[]>(5 * 60_000);

const corsOptions: CorsOptions = {
  origin: [],
  methods: ['POST', 'GET', 'PATCH', 'DELETE'],
  credentials: true,
};
corsOptions.allowedHeaders = ['Content-Type','X-CSRF-Token']
if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'staging') {
  corsOptions.origin = true
} else if (process.env.NODE_ENV === 'production') {
  corsOptions.origin = [`${FRONTEND_URL}`];
}
app.use(cors(corsOptions));

app.use(express.json());

app.use(
  session({
    // Mongo-backed session store for persistent user sessions
    store: MongoStore.create({
      mongoUrl: sessionStoreUrl,
      collectionName: 'Sessions',
      ttl: 60 * 60, //1 hour
      autoRemove: 'interval',
      autoRemoveInterval: 10
    }),
    // Secret key for signing cookies
    secret: process.env.SESSION_SECRET!,
    // Standard security/session config
    resave: false,
    saveUninitialized: false,
    proxy: true,
    
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging',
      sameSite: 'lax',
      maxAge: 60 * 60 * 1000, //1 hour
    },
  }),
);

app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

app.use(['/api/attendance'], limit.attendanceLimiter)

app.use(['/api/users', '/api/reports'], limit.adminLimiter)

app.use(helmet()); app.use(helmet.hsts({ maxAge: 15552000, preload:true }));

app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'none'"],      // API should not serve HTML assets
      frameAncestors: ["'none'"],
    },
  })
)

app.use(csrfMiddleware);

app.disable('x-powered-by');

app.set('trust proxy', 1);

if (!cosmosDbUri) {
   // Ensure DB URI is defined before starting the server
  throw new Error('URI is not defined in the environment variables.');
}
const client = new MongoClient(cosmosDbUri);

client.connect().then(() => {
  console.log("DB Connected");
  const db = client.db(`${DB_NAME}`);
  const usersCollection = db.collection('Usernames');
  const recordsCollection = db.collection('Records');
  const eventsCollection = db.collection('Events');
  const countersCollection = db.collection<{ _id: string; seq: number }>("Counters");

  function isEmptyXlsxCellValue(value: XlsxCell): boolean {
    if (value == null) return true;
    if (typeof value === "string") return value.trim() === "";
    return false;
  }

  function removeEmptyColumns(
    rows: XlsxRow[],
    headerRowIndex = 0,
    firstRemovableColumnIndex = 1
  ): XlsxRow[] {
    const maxColumnCount = Math.max(...rows.map((row) => row.length));

    for (
      let columnIndex = maxColumnCount - 1;
      columnIndex >= firstRemovableColumnIndex;
      columnIndex--
    ) {
      const hasData = rows
        .slice(headerRowIndex + 1)
        .some((row) => !isEmptyXlsxCellValue(row[columnIndex]));

      if (!hasData) {
        for (const row of rows) {
          row.splice(columnIndex, 1);
        }
      }
    }

    return rows;
  }

  function invalidateUserCaches() {
    usernameSearchCache.clear();
    userNamesCache.clear();
    usersListCache.clear();
    reportUsersCache.clear();
  }

  function invalidateEventCaches() {
    eventListCache.delete("listIncidents");
    eventListCache.delete("listEvents");
  }

  function generateCodeVerifier() {
    return crypto.randomBytes(32).toString('base64url');
  }

  function generateCodeChallenge(verifier: string) {
    return crypto.createHash('sha256').update(verifier).digest('base64url');
  }

  function getOperationalStatusForActivity(activity: string) {
    if (operationalActivities.has(activity)) {
      return "Operational";
    }

    if (nonOperationalActivities.has(activity)) {
      return "Non-Operational";
    }

    return null;
  }

  function normalizeNameKey(value: unknown): string {
    return String(value ?? "")
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();
  }

  function escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function caseAndSpaceInsensitiveExactFilter(value: unknown) {
    const parts = String(value ?? "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map(escapeRegex);

    return {
      $regex:
        parts.length > 0
          ? `^\\s*${parts.join("\\s+")}\\s*$`
          : "^\\s*$",
      $options: "i",
    };
  }

  function normalizeRoleReportKey(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
  }

  function cleanRoleReportDisplayValue(value: unknown): string {
    return String(value ?? "")
      .trim()
      .replace(/\s+/g, " ");
  }

  function escapeRoleReportRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function roleReportCaseAndSpaceInsensitiveFilter(
    value: unknown
  ) {
    const parts = String(value ?? "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map(escapeRoleReportRegex);

    return {
      $regex:
        parts.length > 0
          ? `^\\s*${parts.join("\\s+")}\\s*$`
          : "^\\s*$",
      $options: "i",
    };
  }

  function buildRoleReportQuery(
    startEpoch: number,
    endEpoch: number,
    names: unknown,
    roles: unknown
  ) {
    const query: any = {
      epochTimestamp: {
        $gte: startEpoch,
        $lte: endEpoch,
      },
      roles: {
        $exists: true,
        $ne: [],
      },
    };

    const selectionClauses: any[] = [];

    if (Array.isArray(names) && names.length > 0) {
      selectionClauses.push({
        $or: names.map((selectedName: unknown) => ({
          name: roleReportCaseAndSpaceInsensitiveFilter(
            selectedName
          ),
        })),
      });
    }

    if (Array.isArray(roles) && roles.length > 0) {
      selectionClauses.push({
        $or: roles.map((selectedRole: unknown) => ({
          roles: roleReportCaseAndSpaceInsensitiveFilter(
            selectedRole
          ),
        })),
      });
    }

    if (selectionClauses.length > 0) {
      query.$and = selectionClauses;
    }

    return query;
  }

  function buildRoleReportDisplayMap(
    values: unknown[]
  ): Map<string, string> {
    const displayByKey = new Map<string, string>();

    for (const value of values) {
      const key = normalizeRoleReportKey(value);

      if (!key || displayByKey.has(key)) {
        continue;
      }

      displayByKey.set(
        key,
        cleanRoleReportDisplayValue(value)
      );
    }

    return displayByKey;
  }

  function roleReportRecordHasRoleKey(
    record: any,
    roleKey: string
  ): boolean {
    return (
      Array.isArray(record.roles) &&
      record.roles.some(
        (recordRole: unknown) =>
          normalizeRoleReportKey(recordRole) === roleKey
      )
    );
  }

  async function sendXlsxResponse(
    res: Response,
    filename: string,
    rows: XlsxRow[]
  ) {
    const buffer = await writeExcelFile(rows, {
      sheet: "Report",
      columns: [
        {
          width: 80,
        },
      ],
    }).toBuffer();

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    res.send(Buffer.from(buffer));
  }

  async function getCachedReportUsers() {
  const cached = reportUsersCache.get("reportUsers");

  if (cached) {
    return cached;
  }

  const users = await usersCollection
    .find(
      {},
      {
        projection: {
          name: 1,
          id: 1,
          member_status: 1,
          membership_classification: 1,
          membership_type: 1,
        },
      }
    )
    .toArray();

  reportUsersCache.set("reportUsers", users);

  return users;
  }

  async function fetchOrThrow<T>(url: string, init: FetchRequestInit): Promise<T> {
    const res = await fetch(url, init);
    if (!res.ok) throw new Error(`${res.status} – ${await res.text()}`);
    return res.json() as Promise<T>;
  }

  const eventService = createEventService({
    eventsCollection,
    countersCollection
  });

  const nonOperationalActivities = new Set([
  "Meeting",
  "Community-Engagement",
  "Other-Non-operational",
  ]);

  const operationalActivities = new Set([
    "Incident-Call",
    "Strike-Team",
    "Deployment",
    "Hazard-Reduction",
    "Pile-Burn",
    "Training",
    "Maintenance",
    "BA-Checks",
    "Chainsaw-Checks",
    "Other-operational",
  ]);


  //Generate CSRF Tokens
  app.get("/csrf-token", limit.csrfTokenLimiter, (req, res) => {
    const csrfToken = (req as any).csrfToken();

    req.session.save((error) => {
      if (error) {
        console.error("Failed to save CSRF token:", error);

        res.status(500).json({
          message: "Failed to create CSRF token.",
        });
        return;
      }

      res.status(200).json({
        csrfToken,
      });
    });
  });
  // Generates OAuth2 login URL with PKCE challenge
  const login: RequestHandler = (req, res) => {

    try { const state = crypto.randomUUID();
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);

    req.session.oauthState = state;
    req.session.codeVerifier = codeVerifier;

    const authUrl = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/authorize?` +
      new URLSearchParams({
        client_id: CLIENT_ID,
        response_type: 'code',
        redirect_uri: REDIRECT_URI,
        response_mode: 'query',
        scope: 'openid profile email user.read GroupMember.Read.All',
        state,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
      }).toString();

    res.redirect(authUrl);
  } catch(error) {
      console.error('Error:', error);
      res.status(500).json({ message: 'Server error' });
      return;
    }
  }
  app.get('/auth/login', limit.authLimiter, login)
  // Handles Microsoft redirect and token exchange
  const redirect: RequestHandler = async (req, res) =>{

  try{
    const code = req.query.code as string;
    const state = req.query.state as string;
    if (!code || !state || state !== req.session.oauthState) {
      res.status(400).send('Invalid or missing OAuth state.');
      return;
    }
    const codeVerifier = req.session.codeVerifier;
    
const tokenData = await fetchOrThrow<AzureTokenResponse>(
    `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        grant_type: 'authorization_code',
        redirect_uri: REDIRECT_URI,
        code,
        code_verifier: codeVerifier ?? '',
        client_secret: CLIENT_SECRET,
      }),
    },
  );

  const access = tokenData.access_token;
  if (!access) throw new Error('No access token');

  const profile = await fetchOrThrow<AzureProfile>('https://graph.microsoft.com/v1.0/me', {
    headers: { Authorization: `Bearer ${access}` },
  });

  const groupsData = await fetchOrThrow<AzureGroupList>('https://graph.microsoft.com/v1.0/me/memberOf', {
    headers: { Authorization: `Bearer ${access}` },
  });

    const isAdmin = Array.isArray(groupsData.value) &&
      groupsData.value.some(g => g.id === ADMIN_GROUP_ID);
    try {
      /* regenerate session ID */
      await promisify(req.session.regenerate.bind(req.session))();

      req.session.user = {
        email: profile.mail ?? profile.userPrincipalName,
        name: profile.displayName,
        id: profile.id,
        isAdmin,
      };
      req.session.cookie.maxAge = 60 * 60 * 1000; // 1 hour

      /* persist & redirect */
      await promisify(req.session.save.bind(req.session))();

      const url = new URL(`${FRONTEND_URL}`);
      url.pathname = '/admin/dashboard';
      res.redirect(url.toString());
      return;
    } catch (err) {
      console.error('Session regeneration error', err);
      res.status(500).send('Login failed – session error');
      return;
    }
  } catch(error) {
      console.error('Error:', error);
      res.status(500).json({ message: 'Server error' });
      return;
    }

  }
  app.get('/auth/redirect', limit.authLimiter, redirect)

  const AuthCheck: RequestHandler = (req, res) => {
    if (!req.session || !req.session.user) {
    return res.status(401).json({ authenticated: false });
  }

  const now = Date.now();
  const expires = req.session.cookie?.expires
    ? new Date(req.session.cookie.expires).getTime()
    : now;

  if (expires <= now) {
    req.session.destroy(() => {
      res.clearCookie('connect.sid', {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
      });
      res.status(401).json({ authenticated: false });
    });
    return;
  }

  // Otherwise valid
  res.json({
    authenticated: true,
    user: req.session.user,
    isAdmin: !!req.session.user.isAdmin,
  });
  }
  app.get('/auth/check', limit.authStatusLimiter, AuthCheck)

  const sessionCheck: RequestHandler = (req, res) => {
      if (req.session?.user) return res.sendStatus(200);
    res.sendStatus(401);

  }
  app.get('/auth/session', limit.authStatusLimiter, sessionCheck)

  const LogOut: RequestHandler = (req, res) => {
    req.session.destroy(() => {
        res.clearCookie('connect.sid');

        const postLogoutRedirect = encodeURIComponent(process.env.POST_LOGOUT_URL!);
        const logoutUrl =
          `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/oauth2/v2.0/logout?post_logout_redirect_uri=${postLogoutRedirect}`;

        res.redirect(logoutUrl);
      });
  };
  app.get('/auth/logout', limit.authLimiter, LogOut)

  const getUsersList: RequestHandler = async (req, res) => {
    const authedReq = req as AuthedRequest;
    authedReq.user = authedReq.session.user;

    try {
      const cached = usersListCache.get("adminUsersList");

      if (cached) {
        return res.status(200).json(cached);
      }

      const users = await usersCollection.find({}).toArray();

      usersListCache.set("adminUsersList", users);

      return res.status(200).json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      return res.status(500).json({ message: "Failed to fetch users" });
    }
  };
  app.get('/api/users/list', limit.adminReadLimiter, requireAdmin, getUsersList);

  const UserNames: RequestHandler = async (req, res) => {
    const authedReq = req as AuthedRequest;
    authedReq.user = authedReq.session.user;

    try {
      const cached = userNamesCache.get("adminUserNames");

      if (cached) {
        return res.status(200).json(cached);
      }

      const users = await usersCollection
        .find({}, { projection: { name: 1, _id: 0 } })
        .toArray();

      userNamesCache.set("adminUserNames", users);

      return res.status(200).json(users);
    } catch (err) {
      return res.status(500).json({ error: "Failed to fetch user names" });
    }
  };
  app.get('/api/users/names', limit.adminReadLimiter, requireAdmin, UserNames)

  const addUser: RequestHandler = async (req, res) => {
    const authedReq = req as AuthedRequest;
    authedReq.user = authedReq.session.user;
  const { firstName, lastName, fireZoneNumber, Status, Classification, Type, honeypot, middleName } = req.body;

    if (honeypot || middleName){ 
      return res.status(400).json({ 
        message: 'Bot detected, form submission blocked', 
      });
    }

    if (!firstName || !lastName || !fireZoneNumber || !Status || !Classification || !Type) {
    res.status(400).json({ message: 'Missing required fields' });
    return;
    }

    function capitaliseNamePart(value: string) {
      return value
        .trim()
        .toLowerCase()
        .replace(/\b[a-z]/g, (char) => char.toUpperCase());
    }
    const formattedFirstName = capitaliseNamePart(firstName);
    const formattedLastName = capitaliseNamePart(lastName);
    const name = `${formattedFirstName} ${formattedLastName}`;
    const username = `${firstName}.${lastName}`.toLowerCase();

    try {
      const result = await usersCollection.insertOne({
        name,
        username,
        id: fireZoneNumber,
        member_status: Status,
        membership_classification: Classification,
        membership_type: Type,
      });
      res.status(201).json({ message: 'User added successfully', result });
      invalidateUserCaches();
      return;
    } catch (error) {
      console.error('Error adding user', error);
      res.status(500).json({ message: 'Failed to add user' });
      return
    }
  };
  app.post('/api/users/addUser', limit.adminUserMutationLimiter, sanitise.sanitizeUser, requireAdmin, addUser)

  const deleteUser: RequestHandler = async (req, res) => {
    const authedReq = req as AuthedRequest;
    authedReq.user = authedReq.session.user;
    const { numbers } = req.body;

    try {
      const deleteResult = await usersCollection.deleteMany({ id: { $in: numbers } });
      if (deleteResult.deletedCount === 0) {
        res.status(404).json({success: false, message: 'No users found with those fire zone numbers' });
        return;
      }
      res.status(200).json({success: true, message: `${deleteResult.deletedCount} user(s) deleted successfully` });
      invalidateUserCaches();
      return;
    } catch (error) {
      console.error('Error deleting users', error);
      res.status(500).json({ success: false, message: 'Failed to delete users' });
      return;
    }

  };
  app.post('/api/users/delete', limit.adminDeleteLimiter, requireAdmin, sanitise.sanitizeFireZoneNumber, deleteUser)

  const updateUser: RequestHandler = async (req, res) => {
    const authedReq = req as AuthedRequest;
    authedReq.user = authedReq.session.user;
  const { oldname, name, oldfzNumber, fzNumber, memberStatus, memberClassification, memberType } = req.body;
      const [firstname, ...lastnameArr] = name.split(' ');
      const lastname = lastnameArr.join(' ');

      function capitaliseNamePart(value: string) {
        return value
          .trim()
          .toLowerCase()
          .replace(/\b[a-z]/g, (char) => char.toUpperCase());
      }
      const formattedFirstName = capitaliseNamePart(firstname)
      const formattedLastName = capitaliseNamePart(lastname)
      const updatedUser = {
        name: `${formattedFirstName} ${formattedLastName}`,
        username: `${firstname}.${lastname}`.toLowerCase(),
        id: fzNumber,
        member_status: memberStatus,
        membership_classification: memberClassification,
        membership_type: memberType,
      };

      try {
        const updateUser = await usersCollection.findOneAndUpdate(
          { id: oldfzNumber },
          { $set: updatedUser },
          { returnDocument: 'after' }
        );
        const updateRecord = await recordsCollection.updateMany(
          { name: oldname },
          { $set: { name: updatedUser.name } }
        );
        const userOk    = !!(updateUser?.modifiedCount ?? updateUser);
        const recordOk  = !!(updateRecord?.modifiedCount ?? updateRecord);
        if (userOk && recordOk) {
          invalidateUserCaches();
          return res.status(200).json({
            success: true,
            message: "User and records updated.",
            updateUser,
            updateRecord,
          });
        }

        if (userOk && !recordOk) {
          invalidateUserCaches();
          return res.status(200).json({
            success: true,
            message: "User updated. No records found to update.",
            updateUser,
            updateRecord,
          });
        }

        if (!userOk && recordOk) {
          invalidateUserCaches();
          return res.status(200).json({
            success: true,
            partial: true,
            message: "Records updated, but user not found/updated.",
            updateUser,
            updateRecord,
          });
        }
        return res.status(404).json({
          success: false,
          message: "No user or records found to update.",
          updateUser,
          updateRecord,
        });
      } catch (error) {
        console.error('Error updating User:', error);
        res.status(500).json({ success: false, message: 'An error occurred while updating the User.' });
        return;
      }
  }
  app.patch('/api/users/updateRecord', limit.adminUserMutationLimiter, requireAdmin, sanitise.sanitizeUpdatedUser,  updateUser)

  const reportRun: RequestHandler = async (req, res) => {
    const authedReq = req as AuthedRequest;
    authedReq.user = authedReq.session.user;

    function getActivityDetails(record: any) {
      return {
        baType: record.details?.baType ?? record.baType,
        chainsawType:
          record.details?.chainsawType ?? record.chainsawType,
        deploymentType:
          record.details?.deploymentType ?? record.deploymentType,
        deploymentLocation:
          record.details?.deploymentLocation ??
          record.deploymentLocation,
        otherType:
          record.details?.otherType ?? record.otherType,
      };
    }

    const {
      startEpoch,
      endEpoch,
      name,
      activity,
      operational,
      detailed,
      includeZeroAttendance,
    } = req.body;

    try {
      const MAX_SPAN = 1095 * 24 * 60 * 60 * 1000; // 3 years ms

      if (endEpoch - startEpoch > MAX_SPAN) {
        res.status(400).json({
          message: "Date range too large (max 3 years)",
        });
        return;
      }

      const query: any = {
        epochTimestamp: {
          $gte: startEpoch,
          $lte: endEpoch,
        },
      };

      if (name) {
        query.name = caseAndSpaceInsensitiveExactFilter(name);
      }

      if (activity) {
        query.activity =
          caseAndSpaceInsensitiveExactFilter(activity);
      }

      if (operational) {
        query.operational =
          caseAndSpaceInsensitiveExactFilter(operational);
      }

      const MAX_ROWS = 50000;

      const recordsCursor = recordsCollection
        .find(query)
        .limit(MAX_ROWS + 1);

      const records = await recordsCursor.toArray();

      if (records.length > MAX_ROWS) {
        res.status(413).json({
          error:
            "Result too large. Narrow date range or filters.",
        });
        return;
      }

      /*
      * Detailed report-run mode returns the individual
      * attendance records, as it did previously.
      */
      if (detailed === true) {
        const transformed = records.map((record: any) => {
          const details = getActivityDetails(record);

          return {
            ...record,

            timestampLocal: moment
              .tz(
                record.epochTimestamp,
                "Australia/Sydney"
              )
              .format("DD-MM-YYYY HH:mm"),

            ...(details.baType && {
              baType: details.baType,
            }),

            ...(details.chainsawType && {
              chainsawType: details.chainsawType,
            }),

            ...(details.deploymentType && {
              deploymentType: details.deploymentType,
            }),

            ...(details.deploymentLocation && {
              deploymentLocation:
                details.deploymentLocation,
            }),

            ...(details.otherType && {
              otherType: details.otherType,
            }),
          };
        });

        res.status(200).json({
          count: transformed.length,
          records: transformed,
        });
        return;
      }

      /*
      * Summary mode.
      */
      const userDataMap = new Map<string, any>();
      const usersWithRecords = new Set<string>();

      const allUsers = await getCachedReportUsers();

      const usersByName = new Map<string, any>(
        allUsers.map(
          (user: any): [string, any] => [
            normalizeNameKey(user.name),
            user,
          ]
        )
      );

      for (const record of records) {
        const recordName = String(
          record.name ?? ""
        ).trim();

        const userKey = normalizeNameKey(recordName);

        usersWithRecords.add(userKey);

        if (!userDataMap.has(userKey)) {
          const userDetails = usersByName.get(userKey);

          /*
          * Do not discard attendance when an associated
          * Usernames document cannot be found.
          *
          * When found, use the current canonical name from
          * Usernames. Otherwise, use the record's name.
          */
          userDataMap.set(userKey, {
            name: userDetails?.name ?? recordName,
            memberNumber: userDetails?.id ?? "",
            status:
              userDetails?.member_status ?? "",
            membership_classification:
              userDetails?.membership_classification ?? "",
            membership_type:
              userDetails?.membership_type ?? "",
            operationalActivities: 0,
            nonOperationalActivities: 0,
            records: [],
          });
        }

        const userStats = userDataMap.get(userKey);

        if (!userStats) {
          continue;
        }

        userStats.records.push({
          operational: record.operational,
          activity: record.activity,
        });

        const operationalKey = String(
          record.operational ?? ""
        )
          .trim()
          .toLowerCase();

        if (operationalKey === "operational") {
          userStats.operationalActivities++;
        } else if (
          operationalKey === "non-operational"
        ) {
          userStats.nonOperationalActivities++;
        }
      }

      if (includeZeroAttendance) {
        /*
        * Use the already-loaded user list and normalized keys.
        * This prevents a user being shown as both attended and
        * zero attendance because of capitalization differences.
        */
        for (const user of allUsers) {
          const userKey = normalizeNameKey(user.name);

          if (
            !usersWithRecords.has(userKey) &&
            !userDataMap.has(userKey)
          ) {
            userDataMap.set(userKey, {
              name: user.name,
              memberNumber: user.id || "",
              status: user.member_status,
              membership_classification:
                user.membership_classification,
              membership_type:
                user.membership_type,
              operationalActivities: 0,
              nonOperationalActivities: 0,
              records: [],
            });
          }
        }
      }

      /*
      * Use the stored canonical name, not the normalized
      * lowercase map key, in the API response.
      */
      const dto = [...userDataMap.values()].map(
        (user) => ({
          user: user.name,
          memberNumber: user.memberNumber,
          status: user.status,
          membership_classification:
            user.membership_classification,
          membership_type:
            user.membership_type,
          operationalActivities:
            user.operationalActivities,
          nonOperationalActivities:
            user.nonOperationalActivities,
        })
      );

      res.status(200).json(dto);
      return;
    } catch (error) {
      console.error(
        "Unable to fetch records",
        (error as Error).message
      );

      res.status(500).json({
        message: "Unable to fetch records",
      });
      return;
    }
  };
  app.post('/api/reports/run', limit.reportRunLimiter, requireAdmin, sanitise.sanitizeReportingRunInput, reportRun);

  const reportExport: RequestHandler = async (
    req,
    res
  ) => {
    const authedReq = req as AuthedRequest;
    authedReq.user = authedReq.session.user;

    function getActivityDetails(record: any) {
      return {
        baType:
          record.details?.baType ?? record.baType,
        chainsawType:
          record.details?.chainsawType ??
          record.chainsawType,
        deploymentType:
          record.details?.deploymentType ??
          record.deploymentType,
        deploymentLocation:
          record.details?.deploymentLocation ??
          record.deploymentLocation,
        otherType:
          record.details?.otherType ??
          record.otherType,
      };
    }

    const {
      startEpoch,
      endEpoch,
      name,
      activity,
      operational,
      includeZeroAttendance,
      detailed,
      formattedStart,
      formattedEnd,
    } = req.body;

    try {
      /*
      * Apply the same maximum range restriction as reportRun.
      */
      const MAX_SPAN =
        1095 * 24 * 60 * 60 * 1000; // 3 years ms

      if (endEpoch - startEpoch > MAX_SPAN) {
        res.status(400).json({
          message: "Date range too large (max 3 years)",
        });
        return;
      }

      const query: any = {
        epochTimestamp: {
          $gte: startEpoch,
          $lte: endEpoch,
        },
      };

      if (name) {
        query.name =
          caseAndSpaceInsensitiveExactFilter(name);
      }

      if (activity) {
        query.activity =
          caseAndSpaceInsensitiveExactFilter(activity);
      }

      if (operational) {
        query.operational =
          caseAndSpaceInsensitiveExactFilter(
            operational
          );
      }

      const MAX_ROWS = 50000;

      const recordsCursor = recordsCollection
        .find(query)
        .limit(MAX_ROWS + 1);

      const records =
        await recordsCursor.toArray();

      if (records.length > MAX_ROWS) {
        res.status(413).json({
          error:
            "Result too large. Narrow date range or filters.",
        });
        return;
      }

      const userDataMap =
        new Map<string, any>();

      const userNoAttendanceDataMap =
        new Map<string, any>();

      const usersWithRecords =
        new Set<string>();

      const allUsers =
        await getCachedReportUsers();

      const usersByName = new Map<string, any>(
        allUsers.map(
          (user: any): [string, any] => [
            normalizeNameKey(user.name),
            user,
          ]
        )
      );

      for (const record of records) {
        const recordName = String(
          record.name ?? ""
        ).trim();

        const userKey =
          normalizeNameKey(recordName);

        usersWithRecords.add(userKey);

        if (!userDataMap.has(userKey)) {
          const userDetails =
            usersByName.get(userKey);

          /*
          * Keep records even when there is no matching
          * Usernames document.
          */
          userDataMap.set(userKey, {
            name:
              userDetails?.name ?? recordName,
            memberNumber:
              userDetails?.id ?? "",
            status:
              userDetails?.member_status ?? "",
            Membership_Classification:
              userDetails?.membership_classification ??
              "",
            membership_type:
              userDetails?.membership_type ?? "",

            ...(detailed === false && {
              operationalActivities: 0,
              nonOperationalActivities: 0,
            }),

            records: [],
          });
        }

        const userStats =
          userDataMap.get(userKey);

        if (!userStats) {
          continue;
        }

        const details =
          getActivityDetails(record);

        userStats.records.push({
          timestampLocal: moment
            .tz(
              record.epochTimestamp,
              "Australia/Sydney"
            )
            .format("DD-MM-YYYY HH:mm"),

          operational: record.operational,
          activity: record.activity,

          ...(details.baType && {
            baType: details.baType,
          }),

          ...(details.chainsawType && {
            chainsawType:
              details.chainsawType,
          }),

          ...(details.deploymentType && {
            deploymentType:
              details.deploymentType,
          }),

          ...(details.otherType && {
            otherType: details.otherType,
          }),

          ...(details.deploymentLocation && {
            deploymentLocation:
              details.deploymentLocation,
          }),
        });

        if (detailed === false) {
          const operationalKey = String(
            record.operational ?? ""
          )
            .trim()
            .toLowerCase();

          if (
            operationalKey === "operational"
          ) {
            userStats.operationalActivities++;
          } else if (
            operationalKey ===
            "non-operational"
          ) {
            userStats.nonOperationalActivities++;
          }
        }
      }

      if (
        detailed === false &&
        includeZeroAttendance
      ) {
        /*
        * Check zero attendance using normalized keys,
        * using the same cached user list.
        */
        for (const user of allUsers) {
          const userKey =
            normalizeNameKey(user.name);

          if (!usersWithRecords.has(userKey)) {
            userNoAttendanceDataMap.set(
              userKey,
              {
                name: user.name,
                memberNumber: user.id || "",
                status: user.member_status,
                Membership_Classification:
                  user.membership_classification,
                membership_type:
                  user.membership_type,
                operationalActivities: 0,
                nonOperationalActivities: 0,
                records: [],
              }
            );
          }
        }
      }

      const rows: XlsxRow[] = [];

      if (detailed === false) {
        rows.push([
          "Name",
          "Member Number",
          "Status",
          "Membership Classification",
          "Membership Type",
          "Operational Activities",
          "Non-Operational Activities",
        ]);

        userDataMap.forEach((user: any) => {
          rows.push([
            user.name,
            user.memberNumber,
            user.status,
            user.Membership_Classification,
            user.membership_type,
            user.operationalActivities,
            user.nonOperationalActivities,
          ]);
        });

        userNoAttendanceDataMap.forEach(
          (user: any) => {
            /*
            * Keep all seven columns aligned with
            * the seven report headers.
            */
            rows.push([
              user.name,
              user.memberNumber,
              user.status,
              user.Membership_Classification,
              user.membership_type,
              0,
              0,
            ]);
          }
        );
      } else if (detailed === true) {
        rows.push([
          "Timestamp",
          "Name",
          "Member Number",
          "Status",
          "Membership Classification",
          "Membership Type",
          "Operational",
          "Activity",
          "Activity Detail",
          "Activity Location",
        ]);

        userDataMap.forEach((user: any) => {
          for (const record of user.records) {
            let activityType = "";
            let activityLocation = "";

            /*
            * Case-insensitive activity comparison
            * for selecting activity details.
            */
            const activityKey = String(
              record.activity ?? ""
            )
              .trim()
              .toLowerCase();

            if (activityKey === "ba-checks") {
              activityType =
                record.baType || "";
            } else if (
              activityKey === "chainsaw-checks"
            ) {
              activityType =
                record.chainsawType || "";
            } else if (
              activityKey ===
                "other-non-operational" ||
              activityKey ===
                "other-operational"
            ) {
              activityType =
                record.otherType || "";
            } else if (
              activityKey === "deployment"
            ) {
              activityType =
                record.deploymentType || "";

              activityLocation =
                record.deploymentLocation || "";
            }

            rows.push([
              record.timestampLocal,
              user.name,
              user.memberNumber,
              user.status,
              user.Membership_Classification,
              user.membership_type,
              record.operational,
              record.activity,
              activityType,
              activityLocation,
            ]);
          }
        });
      } else {
        res.status(400).json({
          error:
            "Invalid report detail option.",
        });
        return;
      }

      removeEmptyColumns(rows, 0, 1);

      const fallbackFormat = (
        epoch: number
      ) =>
        new Date(epoch)
          .toISOString()
          .slice(0, 10)
          .replace(/-/g, "");

      const fileStart =
        formattedStart ||
        fallbackFormat(startEpoch);

      const fileEnd =
        formattedEnd ||
        fallbackFormat(endEpoch);

      const filename =
        `member-attendance-report-` +
        `${fileStart}-${fileEnd}.xlsx`;

      await sendXlsxResponse(
        res,
        filename,
        rows
      );
      return;
    } catch (error) {
      console.error(
        "Error generating Excel report",
        error
      );

      res.status(500).json({
        error: "Failed to export report",
      });
      return;
    }
  };
  app.post("/api/reports/export", limit.reportExportLimiter, requireAdmin, sanitise.sanitizeReportingExportInput, reportExport);
  
  const CheckUsername: RequestHandler = async (req, res) => {
  try {
    const rawUsernames: unknown[] = Array.isArray(req.body.usernames)
      ? req.body.usernames
      : [req.body.username];

    const usernames: string[] = Array.from(
      new Set(
        rawUsernames
          .map((username: unknown) =>
            String(username ?? "").trim().toLowerCase()
          )
          .filter((username: string) => Boolean(username))
      )
    );

    if (usernames.length === 0) {
      req.session.validUsername = undefined;
      req.session.validUsernames = undefined;

      return res.status(400).json({
        ok: false,
        message: "No usernames provided.",
      });
    }

    if (usernames.length > 20) {
      req.session.validUsername = undefined;
      req.session.validUsernames = undefined;

      return res.status(400).json({
        ok: false,
        message: "Too many usernames selected.",
      });
    }

    type UsernameResult = {
      username?: string;
    };

    const users = await usersCollection
      .find<UsernameResult>(
        {
          username: {
            $in: usernames,
          },
        },
        {
          projection: {
            _id: 1,
            username: 1,
          },
        }
      )
      .toArray();

    const foundUsernames = new Set<string>(
      users.map((user) => String(user.username ?? "").toLowerCase())
    );

    const missingUsernames = usernames.filter((username: string) =>
      !foundUsernames.has(username)
    );

    if (missingUsernames.length > 0) {
      req.session.validUsername = undefined;
      req.session.validUsernames = undefined;

      return res.status(404).json({
        ok: false,
        message: "One or more usernames were not found.",
        missingUsernames,
      });
    }

    req.session.validUsername = usernames[0];
    req.session.validUsernames = usernames;

    return res.status(200).json({
      ok: true,
      usernames,
    });
  } catch (e) {
    console.error("checkUser error", e);

    return res.status(500).json({
      ok: false,
      message: "Unable to check usernames.",
    });
  }
  };
  app.post('/api/attendance/checkUser', limit.usernameCheckLimiter, sanitise.sanitizeCheckUsernameInput, CheckUsername)

  const submitAttendance: RequestHandler = async (req, res) => {

    const eventRequiredActivities = [
      "Incident-Call",
      "Pile-Burn",
      "Hazard-Reduction",
      "Deployment",
      "Strike-Team",
      "Training",
      "Community-Engagement",
      "Other-operational",
    ];

    function activityRequiresEvent(activity: string) {
      return eventRequiredActivities.includes(activity);
    }

    function nameToUsername(name: string) {
      return String(name).trim().replace(/\s+/g, ".").toLowerCase();
    }

    try {
      const {
        name,
        names,
        operational,
        activity,
        epochTimestamp,
        baType,
        chainsawType,
        deploymentType,
        deploymentLocation,
        otherType,
        eventNumber,
      } = req.body;
      const submittedNames = Array.isArray(names) ? names : [name];

      const cleanNames = Array.from(
        new Set(
          submittedNames
            .map((submittedName) => String(submittedName ?? "").trim())
            .filter(Boolean)
        )
      );

      if (cleanNames.length === 0) {
        return res.status(400).json({
          message: "At least one name is required.",
        });
      }

      if (cleanNames.length > 20) {
        return res.status(400).json({
          message: "Too many names submitted.",
        });
      }

      const submittedUsernames = cleanNames.map(nameToUsername);

      const validSessionUsernames = Array.isArray(req.session.validUsernames)
        ? req.session.validUsernames.map((username) =>
            String(username).toLowerCase()
          )
        : req.session.validUsername
        ? [String(req.session.validUsername).toLowerCase()]
        : [];

      const validUsernameSet = new Set(validSessionUsernames);

      const allNamesValidated = submittedUsernames.every((username) =>
        validUsernameSet.has(username)
      );

      if (!allNamesValidated) {
        return res.status(403).json({
          message: "One or more usernames were not validated in this session.",
        });
      }

      const eventDate = moment(epochTimestamp)
        .tz("Australia/Sydney")
        .format("YYYY-MM-DD");

      let finalEventNumber: string | undefined = undefined;
      let eventCreated = false;

      if (activityRequiresEvent(activity)) {
        const { event, eventCreated: created } =
          await eventService.resolveEventForAttendance(
            activity,
            eventDate,
            eventNumber
          );

        finalEventNumber = event.eventNumber;
        eventCreated = created;
      }

      function buildDetailsVariants() {
        if (activity === "BA-Checks") {
          const baTypes =
            baType === "All Vehicles"
              ? ["Cat 1", "Pumper"]
              : [baType];

          return baTypes.map((type) => ({
            baType: type,
          }));
        }

        if (activity === "Chainsaw-Checks") {
          const chainsawTypes =
            chainsawType === "All Vehicles"
              ? ["Cat 1", "Pumper", "Cat 9"]
              : [chainsawType];

          return chainsawTypes.map((type) => ({
            chainsawType: type,
          }));
        }

        if (activity === "Deployment") {
          return [
            {
              deploymentType,
              deploymentLocation,
            },
          ];
        }

        if (
          activity === "Other-Non-operational" ||
          activity === "Other-operational"
        ) {
          return [
            {
              otherType,
            },
          ];
        }

        return [{}];
      }

      const detailsVariants = buildDetailsVariants();

      const records = cleanNames.flatMap((cleanName) =>
        detailsVariants.map((details) => {
          const record: any = {
            name: cleanName,
            operational,
            activity,
            details,
            roles: [] as string[],
            epochTimestamp,
          };

          if (finalEventNumber) {
            record.eventNumber = finalEventNumber;
          }

          return record;
        })
      );
      const result =
        records.length === 1
          ? await recordsCollection.insertOne(records[0])
          : await recordsCollection.insertMany(records);

      if (eventCreated) {
        invalidateEventCaches();
      }

      return res.status(201).json({
        message: eventCreated
          ? "Attendance submitted successfully. A new event was created."
          : "Attendance submitted successfully.",
        insertedCount: records.length,
        eventCreated,
        eventNumber: finalEventNumber,
        result,
      });
    } catch (error) {
      console.error("Error submitting attendance:", error);

      if ((error as any).code === 11000) {
        return res.status(409).json({
          message: "Attendance has already been recorded for this event.",
        });
      }

      return res.status(500).json({
        message: "Failed to submit attendance.",
      });
    }
  };
  app.post('/api/attendance/submit', limit.attendanceSubmitLimiter, sanitise.sanitizeAttendanceInput, submitAttendance)

  const listNames: RequestHandler = async (req, res) => {
    try {
      const query = String(req.query.q ?? "");

      if (query.length < 2) {
        return res.status(200).json([]);
      }

      const cacheKey = `username:${query}`;
      const cached = usernameSearchCache.get(cacheKey);

      if (cached) {
        return res.status(200).json(cached);
      }

      const safeRegex = new RegExp("^" + escapeStringRegexp(query), "i");

      const names = await usersCollection
        .find(
          { username: safeRegex },
          {
            projection: {
              username: 1,
              _id: 0,
            },
          }
        )
        .limit(10)
        .toArray();

      const result = names.map((u) => u.username);

      usernameSearchCache.set(cacheKey, result);

      return res.status(200).json(result);
    } catch (error) {
      console.error("Unable to list usernames:", error);

      return res.status(500).json({
        message: "Unable to list usernames.",
      });
    }
  };
  app.get('/api/attendance/usernameList',  limit.usernameSearchLimiter, sanitise.sanitizeUsernameListQuery, listNames)
  
  const createIncident: RequestHandler = async (req, res) => {
    const {
      date,
      activID,
      incidentDescription
    } = req.body

    const record = {
      eventNumber: activID,
      eventDate: date,
      description: incidentDescription,
      eventType: "Incident-Call",
      createdAtEpoch: Date.now()
    }
    try {
    const result = await eventsCollection.insertOne(record);
    res.status(200).json({ message: 'Incident created successfully', result });
    invalidateEventCaches();
    } 
    catch (error: any) {
      if (error?.code === 11000) {
        return res.status(409).json({
          message: "An incident with this incident number already exists."
        });
      }
      console.error("Error submitting data", error);

      return res.status(500).json({
        message: "Failed to submit data"
      });
    }
  }
  app.post('/api/attendance/createIncident', limit.incidentCreateLimiter, sanitise.sanitizeIncidentCreation, createIncident)
  
  const deleteIncident: RequestHandler = async (req, res) => {
    const eventNumber = String(req.params.eventNumber ?? "").trim();

    if (!eventNumber) {
      return res.status(400).json({
        message: "Bad request.",
      });
    }

    try {
      const isEvent = eventNumber.startsWith("EVT-");
      const isIncident = !isEvent;

      const existingEvent = await eventsCollection.findOne(
        { eventNumber },
        {
          projection: {
            _id: 1,
            eventNumber: 1,
          },
        }
      );

      if (!existingEvent) {
        return res.status(404).json({
          message: `${isEvent ? "Event" : "Incident"} ${eventNumber} not found and could not be deleted.`,
        });
      }

      const attendanceCount = await recordsCollection.countDocuments({
        eventNumber,
      });

      if (isIncident && attendanceCount > 0) {
        return res.status(409).json({
          message: "Unable to delete incident as there are attendances against it.",
        });
      }

      if (isEvent && attendanceCount > 1) {
        return res.status(409).json({
          message: "Unable to delete event as there is more than 1 attendance against it.",
        });
      }

      let deletedAttendanceCount = 0;

      if (isEvent && attendanceCount === 1) {
        const attendanceDeleteResult = await recordsCollection.deleteMany({
          eventNumber,
        });

        deletedAttendanceCount = attendanceDeleteResult.deletedCount ?? 0;
      }

      const eventDeleteResult = await eventsCollection.deleteOne({
        eventNumber,
      });

      if (eventDeleteResult.deletedCount !== 1) {
        return res.status(500).json({
          message: `${isEvent ? "Event" : "Incident"} attendance was checked, but the event could not be deleted.`,
        });
      }

      invalidateEventCaches();

      return res.status(200).json({
        message: isEvent
          ? `Event ${eventNumber} deleted successfully. ${deletedAttendanceCount} attendance record(s) also deleted.`
          : `Incident ${eventNumber} deleted successfully.`,
        deletedAttendanceCount,
      });
    } catch (error) {
      console.error("Error deleting incident/event", error);

      return res.status(500).json({
        message: "Error unable to delete incident/event. Please try again later.",
      });
    }
  };
  app.delete('/api/attendance/deleteIncident/:eventNumber', limit.incidentCreateLimiter, requireRoleAssignmentPin,  sanitise.sanitizeEventNumberDelete, deleteIncident)

  const listIncidents: RequestHandler = async (req, res) => {
    const cached = eventListCache.get("listIncidents");

    if (cached) {
      return res.status(200).json(cached);
    }

    const today = new Date();
    const thirtyDaysAgo = new Date();

    thirtyDaysAgo.setDate(today.getDate() - 30);

    const thirtyDaysAgoString = thirtyDaysAgo.toISOString().slice(0, 10);

    try {
      const incidents = await eventsCollection
        .find(
          {
            eventType: "Incident-Call",
            eventDate: { $gte: thirtyDaysAgoString },
          },
          {
            projection: {
              _id: 0,
              eventNumber: 1,
              eventDate: 1,
              description: 1,
            },
          }
        )
        .sort({ eventDate: -1 })
        .limit(100)
        .toArray();

      eventListCache.set("listIncidents", incidents);

      return res.status(200).json(incidents);
    } catch {
      return res.status(500).json({ message: "An error occurred" });
    }
  };
  app.get('/api/attendance/listIncidents', limit.eventListLimiter, listIncidents)
  
  const listEvents: RequestHandler = async (req, res) => {
    const cached = eventListCache.get("listEvents");

    if (cached) {
      return res.status(200).json(cached);
    }

    const today = new Date();
    const thirtyDaysAgo = new Date();

    thirtyDaysAgo.setDate(today.getDate() - 30);

    const thirtyDaysAgoString = thirtyDaysAgo.toISOString().slice(0, 10);

    try {
      const events = await eventsCollection
        .find(
          {
            eventType: { $ne: "Incident-Call" },
            eventDate: { $gte: thirtyDaysAgoString },
          },
          {
            projection: {
              _id: 0,
              eventNumber: 1,
              eventDate: 1,
              description: 1,
            },
          }
        )
        .sort({ eventDate: -1 })
        .limit(100)
        .toArray();

      eventListCache.set("listEvents", events);

      return res.status(200).json(events);
    } catch {
      return res.status(500).json({ message: "An error occurred" });
    }
  };
  app.get('/api/attendance/listEvents', limit.eventListLimiter, listEvents)

  const roleAssignmentStatus: RequestHandler = (req, res) => {
    const roleAssignmentUnlockMinutes = 30;
    const unlockedAt = req.session.roleAssignmentUnlockedAt ?? 0;
    const maxAge = roleAssignmentUnlockMinutes * 60 * 1000;

    const unlocked =
      req.session.canAssignRoles === true &&
      Date.now() - unlockedAt <= maxAge;

    if (!unlocked) {
      req.session.canAssignRoles = false;
    }

    return res.status(200).json({
      unlocked,
    });
  };
  app.get( "/api/attendance/roleAssignment/status", limit.roleReadLimiter, roleAssignmentStatus);

  const roleAssignmentUnlock: RequestHandler = async (req, res) => {
    try {
      const pin = String(req.body.pin);

      const expectedPin = process.env.ROLE_ASSIGNMENT_PIN;

      if (!expectedPin || !/^\d{4}$/.test(expectedPin)) {
        return res.status(500).json({
          ok: false,
          message: "Role assignment PIN is not configured correctly.",
        });
      }

      if (pin !== expectedPin) {
        req.session.canAssignRoles = false;
        req.session.roleAssignmentUnlockedAt = undefined;

        return res.status(403).json({
          ok: false,
          message: "Invalid PIN.",
        });
      }

      req.session.canAssignRoles = true;
      req.session.roleAssignmentUnlockedAt = Date.now();

      return res.status(200).json({
        ok: true,
        message: "Role assignment unlocked.",
      });
    } catch (error) {
      console.error("Role assignment unlock error:", error);

      return res.status(500).json({
        ok: false,
        message: "Unable to unlock role assignment.",
      });
    }
  };
  app.post("/api/attendance/roleAssignment/unlock", limit.rolePinLimiter,  sanitise.sanitizeRoleAssignmentPinInput, roleAssignmentUnlock);

  const roleAssignmentEventsByDate: RequestHandler = async (req, res) => {
    try {
      const date = String(req.query.date);

      const events = await eventsCollection
        .find(
          { eventDate: date },
          {
            projection: {
              _id: 0,
              eventNumber: 1,
              eventDate: 1,
              eventType: 1,
              description: 1,
            },
          }
        )
        .limit(100)
        .toArray();

      events.sort((a: any, b: any) => {
        const typeCompare = String(a.eventType ?? "").localeCompare(
          String(b.eventType ?? "")
        );

        if (typeCompare !== 0) return typeCompare;

        return String(a.eventNumber ?? "").localeCompare(
          String(b.eventNumber ?? "")
        );
      });

      return res.status(200).json(events);
    } catch (error) {
      console.error("Error loading role assignment events:", error);

      return res.status(500).json({
        message: "Failed to load events.",
      });
    }
  };
  app.get("/api/attendance/roleAssignment/events", limit.roleReadLimiter, requireRoleAssignmentPin, sanitise.sanitizeEventDateQuery, roleAssignmentEventsByDate);

  const roleAssignmentAttendees: RequestHandler = async (req, res) => {
    try {
      const eventNumber = String(req.query.eventNumber);

      const attendees = await recordsCollection
        .find(
          { eventNumber },
          {
            projection: {
              _id: 1,
              name: 1,
              operational: 1,
              activity: 1,
              eventNumber: 1,
              roles: 1,
              epochTimestamp: 1,
            },
          }
        )
        .limit(200)
        .toArray();

      attendees.sort((a: any, b: any) =>
        String(a.name ?? "").localeCompare(String(b.name ?? ""))
      );

      const dto = attendees.map((record: any) => ({
        recordId: record._id.toString(),
        name: record.name,
        operational: record.operational,
        activity: record.activity,
        eventNumber: record.eventNumber,
        roles: Array.isArray(record.roles) ? record.roles : [],
        timestampLocal: moment
          .tz(record.epochTimestamp, "Australia/Sydney")
          .format("DD-MM-YYYY HH:mm"),
      }));

      return res.status(200).json(dto);
    } catch (error) {
      console.error("Error loading role assignment attendees:", error);

      return res.status(500).json({
        message: "Failed to load attendees.",
      });
    }
  };
  app.get("/api/attendance/roleAssignment/attendees", limit.roleReadLimiter, requireRoleAssignmentPin, sanitise.sanitizeEventNumberQuery, roleAssignmentAttendees);

  const updateEventRoles: RequestHandler = async (req, res) => {
    try {
      const eventNumber = String(req.body.eventNumber);
      const updates = req.body.updates;

      const now = Date.now();
      const operations: AnyBulkWriteOperation<Document>[] = [];

      for (const update of updates) {
        const recordId = String(update.recordId ?? "").trim();

        if (!ObjectId.isValid(recordId)) {
          return res.status(400).json({
            message: "Invalid record ID.",
          });
        }

        operations.push({
          updateOne: {
            filter: {
              _id: new ObjectId(recordId),
              eventNumber,
            },
            update: {
              $set: {
                roles: update.roles,
                rolesUpdatedAtEpoch: now,
              },
            },
          },
        });
      }

      const result = await recordsCollection.bulkWrite(operations);

      return res.status(200).json({
        message: "Roles updated successfully.",
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount,
      });
    } catch (error) {
      console.error("Error updating event roles:", error);

      return res.status(500).json({
        message: "Failed to update roles.",
      });
    }
  };
  app.patch("/api/attendance/roleAssignment/updateRoles", limit.roleUpdateLimiter, requireRoleAssignmentPin, sanitise.sanitizeUpdateEventRolesBody, updateEventRoles);

  const addEventAttendance: RequestHandler = async (req, res) => {
    try {
      const eventNumber = String(req.body.eventNumber);
      const usernames = req.body.usernames as string[];

      const event = await eventsCollection.findOne(
        { eventNumber },
        {
          projection: {
            _id: 0,
            eventNumber: 1,
            eventDate: 1,
            eventType: 1,
            description: 1,
          },
        }
      )

      if (!event) {
        return res.status(404).json({
          message: "Event not found.",
        });
      }

      const activity = String(event.eventType ?? "");
      const operational = getOperationalStatusForActivity(activity);
      if (!operational) {
        return res.status(400).json({
          message: "Selected event has an invalid activity type.",
        });
      }

      const users = await usersCollection
        .find(
          {
            username: {
              $in: usernames,
            },
          },
          {
            projection: {
              _id: 0,
              name: 1,
              username: 1,
            },
          }
        )
        .toArray();

      const userByUsername = new Map(
        users.map((user: any) => [
          String(user.username).toLowerCase(),
          user,
        ])
      );

      const missingUsernames = usernames.filter(
        (username) => !userByUsername.has(String(username).toLowerCase())
      );

      if (missingUsernames.length > 0) {
        return res.status(400).json({
          message: "One or more selected usernames do not exist.",
        });
      }

      const selectedUsers = users.map((user: any) => ({
        username: String(user.username ?? "").toLowerCase(),
        name: String(user.name ?? "").trim(),
      }));

      if (selectedUsers.some((user) => !user.username || !user.name)) {
        return res.status(400).json({
          message: "One or more selected users have incomplete member details.",
        });
      }

      const existingRecords = await recordsCollection
        .find(
          {
            eventNumber,
            name: {
              $in: selectedUsers.map((user) => user.name),
            },
          },
          {
            projection: {
              _id: 0,
              name: 1,
            },
          }
        )
        .toArray();

      const existingNames = new Set(
        existingRecords.map((record: any) => String(record.name))
      );

      const epochTimestamp = moment
        .tz(String(event.eventDate), "YYYY-MM-DD", "Australia/Sydney")
        .valueOf();

      if (!Number.isFinite(epochTimestamp)) {
        return res.status(400).json({
          message: "Selected event has an invalid date.",
        });
      }

      const recordsToInsert = selectedUsers
        .filter((user) => !existingNames.has(user.name))
        .map((user) => ({
          name: user.name,
          operational,
          activity,
          details: {},
          roles: [] as string[],
          eventNumber: event.eventNumber,
          epochTimestamp,
        }));

      if (recordsToInsert.length === 0) {
        return res.status(409).json({
          message: "Selected members are already recorded for this event.",
        });
      }

      const result = await recordsCollection.insertMany(recordsToInsert);

      return res.status(201).json({
        message: `${result.insertedCount} attendance record(s) added.`,
        insertedCount: result.insertedCount,
        skippedCount: selectedUsers.length - recordsToInsert.length,
      });
    } catch (error) {
      console.error("Error adding event attendance:", error);

      if ((error as any).code === 11000) {
        return res.status(409).json({
          message: "One or more selected members are already recorded for this event.",
        });
      }

      return res.status(500).json({
        message: "Failed to add attendance.",
      });
    }
  };
  app.post("/api/attendance/roleAssignment/addAttendance", limit.roleUpdateLimiter, requireRoleAssignmentPin, sanitise.sanitizeAddEventAttendanceBody, addEventAttendance);

  const roleReportRun: RequestHandler = async (
    req,
    res
  ) => {
    try {
      const {
        startEpoch,
        endEpoch,
        names,
        roles,
      } = req.body;

      const hasMembersSelected =
        Array.isArray(names) && names.length > 0;

      const hasRolesSelected =
        Array.isArray(roles) && roles.length > 0;

      if (
        !Number.isFinite(startEpoch) ||
        !Number.isFinite(endEpoch) ||
        endEpoch < startEpoch
      ) {
        return res.status(400).json({
          message: "Invalid date range.",
        });
      }

      const MAX_SPAN =
        1095 * 24 * 60 * 60 * 1000;

      if (endEpoch - startEpoch > MAX_SPAN) {
        return res.status(400).json({
          message:
            "Date range too large. Maximum range is 3 years.",
        });
      }

      if (
        !hasMembersSelected &&
        !hasRolesSelected
      ) {
        return res.status(400).json({
          message:
            "At least one member or role must be selected.",
        });
      }

      const query = buildRoleReportQuery(
        startEpoch,
        endEpoch,
        names,
        roles
      );

      const MAX_ROWS = 5000;

      const records = await recordsCollection
        .find(query, {
          projection: {
            _id: 0,
            name: 1,
            eventNumber: 1,
            operational: 1,
            activity: 1,
            roles: 1,
            epochTimestamp: 1,
          },
        })
        .limit(MAX_ROWS + 1)
        .toArray();

      if (records.length > MAX_ROWS) {
        return res.status(413).json({
          message:
            "Result too large. Narrow date range or selected members.",
        });
      }

      records.sort((a: any, b: any) => {
        const timeA = Number(
          a.epochTimestamp ?? 0
        );

        const timeB = Number(
          b.epochTimestamp ?? 0
        );

        if (timeA !== timeB) {
          return timeA - timeB;
        }

        return normalizeRoleReportKey(
          a.name
        ).localeCompare(
          normalizeRoleReportKey(b.name)
        );
      });

      /*
      * Selected member names normally come from Usernames,
      * so use them as the canonical display values.
      */
      const selectedNameByKey =
        buildRoleReportDisplayMap(
          hasMembersSelected ? names : []
        );

      const dto = records.map((record: any) => {
        const recordName =
          cleanRoleReportDisplayValue(
            record.name
          );

        const userKey =
          normalizeRoleReportKey(recordName);

        return {
          name:
            selectedNameByKey.get(userKey) ??
            recordName,

          eventNumber:
            cleanRoleReportDisplayValue(
              record.eventNumber
            ),

          operational:
            cleanRoleReportDisplayValue(
              record.operational
            ),

          activity:
            cleanRoleReportDisplayValue(
              record.activity
            ),

          /*
          * Preserve all roles on the attendance record,
          * as the original endpoint did.
          */
          roles: Array.isArray(record.roles)
            ? record.roles.map(
                (role: unknown) =>
                  cleanRoleReportDisplayValue(role)
              )
            : [],

          epochTimestamp:
            record.epochTimestamp,

          timestampLocal: moment
            .tz(
              record.epochTimestamp,
              "Australia/Sydney"
            )
            .format("DD-MM-YYYY HH:mm"),
        };
      });

      return res.status(200).json({
        count: dto.length,
        records: dto,
      });
    } catch (error) {
      console.error(
        "Error running role report:",
        error
      );

      return res.status(500).json({
        message: "Failed to run role report.",
      });
    }
  };
  app.post("/api/reports/roles/run", limit.reportRunLimiter, requireAdmin, sanitise.sanitizeRoleReportRunInput, roleReportRun);

  const roleReportExport: RequestHandler = async (
    req,
    res
  ) => {
    try {
      const {
        startEpoch,
        endEpoch,
        names,
        roles,
        formattedStart,
        formattedEnd,
      } = req.body;

      const hasMembersSelected =
        Array.isArray(names) && names.length > 0;

      const hasRolesSelected =
        Array.isArray(roles) && roles.length > 0;

      if (
        !Number.isFinite(startEpoch) ||
        !Number.isFinite(endEpoch) ||
        endEpoch < startEpoch
      ) {
        return res.status(400).json({
          message: "Invalid date range.",
        });
      }

      const MAX_SPAN =
        1095 * 24 * 60 * 60 * 1000;

      if (endEpoch - startEpoch > MAX_SPAN) {
        return res.status(400).json({
          message:
            "Date range too large. Maximum range is 3 years.",
        });
      }

      if (
        !hasMembersSelected &&
        !hasRolesSelected
      ) {
        return res.status(400).json({
          message:
            "At least one member or role must be selected.",
        });
      }

      const query = buildRoleReportQuery(
        startEpoch,
        endEpoch,
        names,
        roles
      );

      const MAX_ROWS = 5000;

      const records = await recordsCollection
        .find(query, {
          projection: {
            _id: 0,
            name: 1,
            eventNumber: 1,
            operational: 1,
            activity: 1,
            roles: 1,
            epochTimestamp: 1,
          },
        })
        .limit(MAX_ROWS + 1)
        .toArray();

      if (records.length === 0) {
        return res.status(404).json({
          message:
            "No role records found to export.",
        });
      }

      if (records.length > MAX_ROWS) {
        return res.status(413).json({
          message:
            "Result too large. Narrow date range or selected filters.",
        });
      }

      records.sort((a: any, b: any) => {
        const timeA = Number(
          a.epochTimestamp ?? 0
        );

        const timeB = Number(
          b.epochTimestamp ?? 0
        );

        if (timeA !== timeB) {
          return timeA - timeB;
        }

        return normalizeRoleReportKey(
          a.name
        ).localeCompare(
          normalizeRoleReportKey(b.name)
        );
      });

      const selectedNameByKey =
        buildRoleReportDisplayMap(
          hasMembersSelected ? names : []
        );

      const selectedRoleByKey =
        buildRoleReportDisplayMap(
          hasRolesSelected ? roles : []
        );

      const getMemberDisplayName = (
        value: unknown
      ): string => {
        const cleaned =
          cleanRoleReportDisplayValue(value);

        return (
          selectedNameByKey.get(
            normalizeRoleReportKey(cleaned)
          ) ?? cleaned
        );
      };

      const getRoleDisplayName = (
        value: unknown
      ): string => {
        const cleaned =
          cleanRoleReportDisplayValue(value);

        return (
          selectedRoleByKey.get(
            normalizeRoleReportKey(cleaned)
          ) ?? cleaned
        );
      };

      /*
      * Event numbers remain identifiers, but both sides are
      * trimmed and normalized for the map lookup.
      */
      const eventNumbers = Array.from(
        new Set<string>(
          records
            .map((record: any) =>
              cleanRoleReportDisplayValue(
                record.eventNumber
              )
            )
            .filter(Boolean)
        )
      );

      const eventDocs =
        eventNumbers.length > 0
          ? await eventsCollection
              .find(
                {
                  eventNumber: {
                    $in: eventNumbers,
                  },
                },
                {
                  projection: {
                    _id: 0,
                    eventNumber: 1,
                    description: 1,
                  },
                }
              )
              .toArray()
          : [];

      const eventDescriptionByNumber =
        new Map<string, string>();

      for (const event of eventDocs) {
        const eventKey =
          normalizeRoleReportKey(
            event.eventNumber
          );

        if (!eventKey) {
          continue;
        }

        eventDescriptionByNumber.set(
          eventKey,
          cleanRoleReportDisplayValue(
            event.description
          )
        );
      }

      const getEventLine = (
        record: any
      ): string => {
        const eventNumber =
          cleanRoleReportDisplayValue(
            record.eventNumber
          );

        const eventKey =
          normalizeRoleReportKey(eventNumber);

        const activity =
          cleanRoleReportDisplayValue(
            record.activity
          );

        const eventDescription =
          eventDescriptionByNumber.get(
            eventKey
          ) ||
          activity ||
          "Event";

        const date = moment
          .tz(
            record.epochTimestamp,
            "Australia/Sydney"
          )
          .format("DD-MM-YYYY HH:mm");

        return `${date}, ${eventDescription}`;
      };

      let rows: XlsxRow[] = [];

      /*
      * Role-only report:
      *
      * Role
      *   Member
      *     Events
      */
      if (
        !hasMembersSelected &&
        hasRolesSelected
      ) {
        rows = [
          [
            {
              value: "Role assigned",
              fontWeight: "bold",
            },
          ],
          [
            {
              value: "Member",
              indent: 1,
            },
          ],
          [
            {
              value: "Events",
              indent: 2,
            },
          ],
          [null],
        ];

        /*
        * Preserve the selected role order while comparing
        * roles case- and whitespace-insensitively.
        */
        const roleOrder = Array.from(
          selectedRoleByKey.entries()
        )
          .filter(([roleKey]) =>
            records.some((record: any) =>
              roleReportRecordHasRoleKey(
                record,
                roleKey
              )
            )
          )
          .map(([roleKey, roleName]) => ({
            roleKey,
            roleName,
          }));

        for (const {
          roleKey,
          roleName,
        } of roleOrder) {
          rows.push([
            {
              value: roleName,
              fontWeight: "bold",
            },
          ]);

          /*
          * Group capitalization and spacing variants of the
          * same member under one normalized member key.
          */
          const memberByKey =
            new Map<string, string>();

          for (const record of records) {
            if (
              !roleReportRecordHasRoleKey(
                record,
                roleKey
              )
            ) {
              continue;
            }

            const memberKey =
              normalizeRoleReportKey(
                record.name
              );

            if (
              !memberKey ||
              memberByKey.has(memberKey)
            ) {
              continue;
            }

            memberByKey.set(
              memberKey,
              getMemberDisplayName(
                record.name
              )
            );
          }

          const memberOrder = Array.from(
            memberByKey.entries()
          )
            .map(
              ([memberKey, memberName]) => ({
                memberKey,
                memberName,
              })
            )
            .sort((a, b) =>
              a.memberName.localeCompare(
                b.memberName,
                undefined,
                {
                  sensitivity: "base",
                }
              )
            );

          for (const {
            memberKey,
            memberName,
          } of memberOrder) {
            rows.push([
              {
                value: memberName,
                indent: 1,
              },
            ]);

            const memberRoleRecords =
              records
                .filter(
                  (record: any) =>
                    normalizeRoleReportKey(
                      record.name
                    ) === memberKey &&
                    roleReportRecordHasRoleKey(
                      record,
                      roleKey
                    )
                )
                .sort(
                  (a: any, b: any) =>
                    Number(
                      a.epochTimestamp ?? 0
                    ) -
                    Number(
                      b.epochTimestamp ?? 0
                    )
                );

            for (
              const record of memberRoleRecords
            ) {
              rows.push([
                {
                  value:
                    getEventLine(record),
                  indent: 2,
                  wrap: true,
                },
              ]);
            }
          }

          rows.push([""]);
        }
      } else {
        /*
        * Member report:
        *
        * Member
        *   Role
        *     Events
        */
        rows = [
          [
            {
              value: "Member",
              fontWeight: "bold",
            },
          ],
          [
            {
              value: "Role performed",
              indent: 1,
            },
          ],
          [
            {
              value: "Events",
              indent: 2,
            },
          ],
          [null],
        ];

        let memberOrder: Array<{
          memberKey: string;
          memberName: string;
        }>;

        if (hasMembersSelected) {
          /*
          * Preserve selected member order.
          */
          memberOrder = Array.from(
            selectedNameByKey.entries()
          )
            .filter(([memberKey]) =>
              records.some(
                (record: any) =>
                  normalizeRoleReportKey(
                    record.name
                  ) === memberKey
              )
            )
            .map(
              ([memberKey, memberName]) => ({
                memberKey,
                memberName,
              })
            );
        } else {
          const memberByKey =
            new Map<string, string>();

          for (const record of records) {
            const memberKey =
              normalizeRoleReportKey(
                record.name
              );

            if (
              !memberKey ||
              memberByKey.has(memberKey)
            ) {
              continue;
            }

            memberByKey.set(
              memberKey,
              getMemberDisplayName(
                record.name
              )
            );
          }

          memberOrder = Array.from(
            memberByKey.entries()
          )
            .map(
              ([memberKey, memberName]) => ({
                memberKey,
                memberName,
              })
            )
            .sort((a, b) =>
              a.memberName.localeCompare(
                b.memberName,
                undefined,
                {
                  sensitivity: "base",
                }
              )
            );
        }

        for (const {
          memberKey,
          memberName,
        } of memberOrder) {
          rows.push([
            {
              value: memberName,
              fontWeight: "bold",
            },
          ]);

          const memberRecords =
            records.filter(
              (record: any) =>
                normalizeRoleReportKey(
                  record.name
                ) === memberKey
            );

          /*
          * Group role capitalization/spacing variants and
          * retain the selected canonical role name when one
          * was selected.
          */
          const roleByKey =
            new Map<string, string>();

          for (const record of memberRecords) {
            if (!Array.isArray(record.roles)) {
              continue;
            }

            for (
              const recordRole of record.roles
            ) {
              const roleKey =
                normalizeRoleReportKey(
                  recordRole
                );

              if (!roleKey) {
                continue;
              }

              if (
                hasRolesSelected &&
                !selectedRoleByKey.has(roleKey)
              ) {
                continue;
              }

              if (!roleByKey.has(roleKey)) {
                roleByKey.set(
                  roleKey,
                  getRoleDisplayName(
                    recordRole
                  )
                );
              }
            }
          }

          const roleOrder = Array.from(
            roleByKey.entries()
          )
            .map(
              ([roleKey, roleName]) => ({
                roleKey,
                roleName,
              })
            )
            .sort((a, b) =>
              a.roleName.localeCompare(
                b.roleName,
                undefined,
                {
                  sensitivity: "base",
                }
              )
            );

          for (const {
            roleKey,
            roleName,
          } of roleOrder) {
            rows.push([
              {
                value: roleName,
                indent: 1,
              },
            ]);

            const roleRecords =
              memberRecords
                .filter((record: any) =>
                  roleReportRecordHasRoleKey(
                    record,
                    roleKey
                  )
                )
                .sort(
                  (a: any, b: any) =>
                    Number(
                      a.epochTimestamp ?? 0
                    ) -
                    Number(
                      b.epochTimestamp ?? 0
                    )
                );

            for (const record of roleRecords) {
              rows.push([
                {
                  value:
                    getEventLine(record),
                  indent: 2,
                  wrap: true,
                },
              ]);
            }
          }

          rows.push([""]);
        }
      }

      const fallbackFormat = (
        epoch: number
      ) =>
        new Date(epoch)
          .toISOString()
          .slice(0, 10)
          .replace(/-/g, "");

      const fileStart =
        formattedStart ||
        fallbackFormat(startEpoch);

      const fileEnd =
        formattedEnd ||
        fallbackFormat(endEpoch);

      const reportType =
        !hasMembersSelected &&
        hasRolesSelected
          ? "role"
          : "member";

      const filename =
        `${reportType}-report-` +
        `${fileStart}-${fileEnd}.xlsx`;

      await sendXlsxResponse(
        res,
        filename,
        rows
      );

      return;
    } catch (error) {
      console.error(
        "Error exporting role report:",
        error
      );

      return res.status(500).json({
        message:
          "Failed to export role report.",
      });
    }
  };
  app.post("/api/reports/roles/export", limit.reportExportLimiter, requireAdmin, sanitise.sanitizeRoleReportExportInput, roleReportExport);

app.use(errorHandler);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
}).catch((err) => {
  console.error('Failed to connect to database:', err);
});
