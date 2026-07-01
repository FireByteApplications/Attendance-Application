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
      sameSite: process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'staging' ? 'none' : 'lax',
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
  const XLSX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function isEmptyXlsxCellValue(value: XlsxCellValue): boolean {
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

async function sendXlsxResponse(
  res: Response,
  filename: string,
  rows: XlsxRow[]
): Promise<void> {
  const buffer = await writeExcelFile(rows).toBuffer();

  res.setHeader("Content-Type", XLSX_CONTENT_TYPE);
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Content-Length", String(buffer.length));

  res.status(200).send(buffer);
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

  const eventService = createEventService({
    eventsCollection,
    countersCollection
  });

  async function fetchOrThrow<T>(url: string, init: FetchRequestInit): Promise<T> {
    const res = await fetch(url, init);
    if (!res.ok) throw new Error(`${res.status} – ${await res.text()}`);
    return res.json() as Promise<T>;
  }

  function generateCodeVerifier() {
    return crypto.randomBytes(32).toString('base64url');
  }

  function generateCodeChallenge(verifier: string) {
    return crypto.createHash('sha256').update(verifier).digest('base64url');
  }

  //Generate CSRF Tokens
  app.get('/csrf-token', limit.csrfTokenLimiter, (req, res) => {
    res.json({ csrfToken: (req as any).csrfToken() });
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

    if (honeypot || middleName) res.status(400).json({ message: 'Bot detected, form submission blocked' });

    if (!firstName || !lastName || !fireZoneNumber || !Status || !Classification || !Type) {
    res.status(400).json({ message: 'Missing required fields' });
    return;
    }

    const name = `${firstName} ${lastName}`;
    const username = `${firstName}.${lastName}`;

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
      const updatedUser = {
        name: name,
        username: `${firstname}.${lastname}`,
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
          {name: oldname},
          {$set: {name: name}}
        )
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
        chainsawType: record.details?.chainsawType ?? record.chainsawType,
        deploymentType: record.details?.deploymentType ?? record.deploymentType,
        deploymentLocation: record.details?.deploymentLocation ?? record.deploymentLocation,
        otherType: record.details?.otherType ?? record.otherType,
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
      res.status(400).json({ message: 'Date range too large (max 3 years)' });
      return;
    }

    const query: any = {
      epochTimestamp: { $gte: startEpoch, $lte: endEpoch },
    };
      if (name) query.name = name;
      if (activity) query.activity = activity;
      if (operational) query.operational = operational;
      const MAX_ROWS = 50000;
      const recordsCursor = recordsCollection.find(query).limit(MAX_ROWS + 1);
      const records = await recordsCursor.toArray();
      if (records.length > MAX_ROWS) {
        res
        .status(413)
        .json({ error: 'Result too large. Narrow date range or filters.' });
        return;
      }
      if(detailed === true){
      const transformed = records.map(record => {
        const details = getActivityDetails(record);

        return {
          ...record,

          timestampLocal: moment
            .tz(record.epochTimestamp, "Australia/Sydney")
            .format("DD-MM-YYYY HH:mm"),

          ...(details.baType && { baType: details.baType }),
          ...(details.chainsawType && { chainsawType: details.chainsawType }),
          ...(details.deploymentType && { deploymentType: details.deploymentType }),
          ...(details.deploymentLocation && {
            deploymentLocation: details.deploymentLocation,
          }),
          ...(details.otherType && { otherType: details.otherType }),
        };
      });
      res.status(200).json({ count: transformed.length, records: transformed });
      return;
    } else {
      const userDataMap = new Map<string, any>();
      const usersWithRecords = new Set<string>();

      const allUsers = await getCachedReportUsers();

      const usersByName = new Map(
        allUsers.map((user: any) => [user.name, user])
      );
       for (const record of records) {
          const userName = record.name;
          usersWithRecords.add(userName);
            if (!userDataMap.has(userName)) {
            const userDetails = usersByName.get(userName);
            if (userDetails) {
              userDataMap.set(userName, {
                name: userName,
                memberNumber: userDetails.id || '',
                status: userDetails.member_status,
                membership_classification: userDetails.membership_classification,
                membership_type: userDetails.membership_type,
                operationalActivities: 0,
                nonOperationalActivities: 0,
                records: []
                });
              }
            }
            const userStats = userDataMap.get(userName);
            if (userStats) {
              userStats.records.push({
                operational: record.operational,
                activity: record.activity,
              });
              if (record.operational === "Operational") userStats.operationalActivities++;
              else if (record.operational === "Non-Operational") userStats.nonOperationalActivities++;
            }
            if (includeZeroAttendance) {
            const allUsers = await usersCollection.find({}).toArray();
            for (const user of allUsers) {
              if (!usersWithRecords.has(user.name)) {
                userDataMap.set(user.name, {
                  name: user.name,
                  memberNumber: user.id || '',
                  status: user.member_status,
                  membership_classification: user.membership_classification,
                  membership_type: user.membership_type,
                  operationalActivities: 0,
                  nonOperationalActivities: 0,
                  records: []
                  });
                }
              } 
            }
        }
      const dto = [...userDataMap].map(([user, v]) => ({
        user,
        memberNumber: v.memberNumber,
        status: v.status,
        membership_classification: v.membership_classification,
        membership_type: v.membership_type,
        operationalActivities: v.operationalActivities,
        nonOperationalActivities: v.nonOperationalActivities,
      }));
      res.status(200).json(dto)
    }
    } catch (error) {
      console.error('Unable to fetch records', (error as Error).message);
      res.status(500).json({ message: "Unable to fetch records" });
      return;
    }
  }
  app.post('/api/reports/run', limit.reportRunLimiter, requireAdmin, sanitise.sanitizeReportingRunInput,  reportRun)


  const reportExport: RequestHandler = async (req, res) => {
    const authedReq = req as AuthedRequest;
    authedReq.user = authedReq.session.user;

    function getActivityDetails(record: any) {
      return {
        baType: record.details?.baType ?? record.baType,
        chainsawType: record.details?.chainsawType ?? record.chainsawType,
        deploymentType: record.details?.deploymentType ?? record.deploymentType,
        deploymentLocation:
          record.details?.deploymentLocation ?? record.deploymentLocation,
        otherType: record.details?.otherType ?? record.otherType,
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
      const query: any = {
        epochTimestamp: { $gte: startEpoch, $lte: endEpoch },
      };

      if (name) query.name = name;
      if (activity) query.activity = activity;
      if (operational) query.operational = operational;

      const MAX_ROWS = 50000;

      const recordsCursor = recordsCollection.find(query).limit(MAX_ROWS + 1);
      const records = await recordsCursor.toArray();

      if (records.length > MAX_ROWS) {
        res.status(413).json({
          error: "Result too large. Narrow date range or filters.",
        });
        return;
      }

      const userDataMap = new Map<string, any>();
      const userNoAttendanceDataMap = new Map<string, any>();
      const usersWithRecords = new Set<string>();

      const allUsers = await getCachedReportUsers();

      const usersByName = new Map(
        allUsers.map((user: any) => [user.name, user])
      );

      for (const record of records) {
        const userName = record.name;
        usersWithRecords.add(userName);

        if (detailed === false) {
          if (!userDataMap.has(userName)) {
            const userDetails = usersByName.get(userName);

            if (userDetails) {
              userDataMap.set(userName, {
                name: userName,
                memberNumber: userDetails.id || "",
                status: userDetails.member_status,
                Membership_Classification:
                  userDetails.membership_classification,
                membership_type: userDetails.membership_type,
                operationalActivities: 0,
                nonOperationalActivities: 0,
                records: [],
              });
            }
          }

          const details = getActivityDetails(record);
          const userStats = userDataMap.get(userName);

          if (userStats) {
            userStats.records.push({
              timestampLocal: moment
                .tz(record.epochTimestamp, "Australia/Sydney")
                .format("DD-MM-YYYY HH:mm"),

              operational: record.operational,
              activity: record.activity,

              ...(details.baType && { baType: details.baType }),
              ...(details.chainsawType && {
                chainsawType: details.chainsawType,
              }),
              ...(details.deploymentType && {
                deploymentType: details.deploymentType,
              }),
              ...(details.otherType && { otherType: details.otherType }),
              ...(details.deploymentLocation && {
                deploymentLocation: details.deploymentLocation,
              }),
            });

            if (record.operational === "Operational") {
              userStats.operationalActivities++;
            } else if (record.operational === "Non-Operational") {
              userStats.nonOperationalActivities++;
            }
          }
        } else if (detailed === true) {
          if (!userDataMap.has(userName)) {
            const userDetails = usersByName.get(userName);

            if (userDetails) {
              userDataMap.set(userName, {
                name: userName,
                memberNumber: userDetails.id || "",
                status: userDetails.member_status,
                Membership_Classification:
                  userDetails.membership_classification,
                membership_type: userDetails.membership_type,
                records: [],
              });
            }
          }

          const details = getActivityDetails(record);
          const userStats = userDataMap.get(userName);

          if (userStats) {
            userStats.records.push({
              timestampLocal: moment
                .tz(record.epochTimestamp, "Australia/Sydney")
                .format("DD-MM-YYYY HH:mm"),

              operational: record.operational,
              activity: record.activity,

              ...(details.baType && { baType: details.baType }),
              ...(details.chainsawType && {
                chainsawType: details.chainsawType,
              }),
              ...(details.deploymentType && {
                deploymentType: details.deploymentType,
              }),
              ...(details.otherType && { otherType: details.otherType }),
              ...(details.deploymentLocation && {
                deploymentLocation: details.deploymentLocation,
              }),
            });
          }
        }
      }

      if (detailed === false && includeZeroAttendance) {
        const allUsers = await usersCollection.find({}).toArray();

        for (const user of allUsers) {
          if (!usersWithRecords.has(user.name)) {
            userNoAttendanceDataMap.set(user.name, {
              name: user.name,
              memberNumber: user.id || "",
              status: user.member_status,
              Membership_Classification: user.membership_classification,
              membership_type: user.membership_type,
              operationalActivities: 0,
              nonOperationalActivities: 0,
              records: [],
            });
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

        userNoAttendanceDataMap.forEach((user: any) => {
          rows.push([
            user.name,
            user.memberNumber,
            user.status,
            user.Membership_Classification,
            user.membership_type,
            "Zero Attendance",
          ]);
        });
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

            if (record.activity === "BA-Checks") {
              activityType = record.baType || "";
            } else if (record.activity === "Chainsaw-Checks") {
              activityType = record.chainsawType || "";
            } else if (
              record.activity === "Other-Non-operational" ||
              record.activity === "Other-operational"
            ) {
              activityType = record.otherType || "";
            } else if (record.activity === "Deployment") {
              activityType = record.deploymentType || "";
              activityLocation = record.deploymentLocation || "";
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
          error: "Invalid report detail option.",
        });
        return;
      }

      removeEmptyColumns(rows, 0, 1);

      const fallbackFormat = (epoch: number) =>
        new Date(epoch).toISOString().slice(0, 10).replace(/-/g, "");

      const fileStart = formattedStart || fallbackFormat(startEpoch);
      const fileEnd = formattedEnd || fallbackFormat(endEpoch);
      const filename = `member-attendance-report-${fileStart}-${fileEnd}.xlsx`;

      await sendXlsxResponse(res, filename, rows);
      return;
    } catch (error) {
      console.error("Error generating Excel report", error);

      res.status(500).json({
        error: "Failed to export report",
      });
      return;
    }
  };
  app.post("/api/reports/export", limit.reportExportLimiter, requireAdmin, sanitise.sanitizeReportingExportInput,  reportExport);


  const CheckUsername: RequestHandler = async (req, res) => {
    try {
      const username = String(req.body.username);

      const exists = await usersCollection.findOne(
        { username },
        {
          projection: {
            _id: 1,
            username: 1,
          },
        }
      );

      if (!exists) {
        req.session.validUsername = undefined;

        return res.status(404).json({
          ok: false,
          message: "Username not found",
        });
      }

      req.session.validUsername = username;

      return res.status(200).json({
        ok: true,
      });
    } catch (e) {
      console.error("checkUser error", e);

      return res.status(500).json({
        ok: false,
        message: "Unable to check username",
      });
    }
  };
  app.post('/api/attendance/checkUser', limit.usernameCheckLimiter, sanitise.sanitizeCheckUsernameInput, CheckUsername)

  const submitAttendance: RequestHandler = async (req, res) => {
  
  const spaceName = (req.body.name as string).trim();
  const dotName   = spaceName.replace(/\s+/g, '.');  
  
  const details: any = {};

  const eventRequiredActivities = [
  "Incident-Call",
  "Pile-Burn",
  "Hazard-Reduction",
  "Deployment",
  "Strike-Team",
  "Training",
  "Community-Engagement",
  "Other-Operational"
  ];

  function activityRequiresEvent(activity: string) {
  return eventRequiredActivities.includes(activity);
  }

  if (req.session.validUsername !== dotName) {
    res.status(403).json({ message: 'Username not validated in this session' });
    return;
  }
  try{
    const {
      name,
      operational,
      activity,
      epochTimestamp,
      baType,
      chainsawType,
      deploymentType,
      deploymentLocation,
      otherType,
      eventNumber
    } = req.body;

    const eventDate = moment(epochTimestamp)
      .tz("Australia/Sydney")
      .format("YYYY-MM-DD");

    let finalEventNumber: string | undefined = undefined;
    let eventCreated = false;

    if (activityRequiresEvent(activity)) {
      const { event, eventCreated: created } = await eventService.resolveEventForAttendance(
        activity,
        eventDate,
        eventNumber
      );

      finalEventNumber = event.eventNumber;
      eventCreated = created;
    }
    // Conditional data fields based on activity type
    if (activity === "Chainsaw-Checks") {
      details.chainsawType = chainsawType;
    }

    if (activity === "BA-Checks") {
      details.baType = baType;
    }

    if (activity === "Deployment") {
      details.deploymentType = deploymentType;
      details.deploymentLocation = deploymentLocation;
    }

    if (activity === "Other-Non-operational" || activity === "Other-operational") {
      details.otherType = otherType;
    }

    const record: any = {
      name,
      operational,
      activity,
      details,
      roles: [] as string[],
      epochTimestamp,
    };

    if (finalEventNumber) {
      record.eventNumber = finalEventNumber;
    }

    const result = await recordsCollection.insertOne(record);
      if (eventCreated) {
        invalidateEventCaches();
      }

      return res.status(201).json({
        message: eventCreated
          ? "Attendance submitted successfully. A new event was created."
          : "Attendance submitted successfully.",
        eventCreated,
        eventNumber: finalEventNumber,
        result
      });
  } catch (error) {
    console.error("Error submitting attendance:", error);
    return res.status(500).json({
      message: "Failed to submit attendance."
    });
  };
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
      eventType: "incident",
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
  app.post('/api/attendance/createIncident', limit.incidentCreateLimiter, requireRoleAssignmentPin, sanitise.sanitizeIncidentCreation, createIncident)
  
  const deleteIncident: RequestHandler = async (req, res) => {
    const {
      eventNumber
    } = req.body
    console.log(req.body)

    if (!req.body.eventNumber) {
      res.status(400).json({message: "Bad request"})
    }
    try {
      const aggregationPipeline = [
        { $match: {eventNumber: {$eq: eventNumber} } },
        { $count: "events_with_incidents"}
      ]

      const findEventsWithIncidents = await recordsCollection.aggregate(aggregationPipeline).toArray()
      const count = findEventsWithIncidents[0]?.events_with_incidents ?? 0;
      if (count > 0) {
        res.status(409).json({message: "Unable to delete incident as there are attendances against it"})
      } else {
        const deleteQuery = {eventNumber : `${eventNumber}`}
        const result = await eventsCollection.deleteOne(deleteQuery)

        if (result.deletedCount === 1) {
          res.status(200).json({message: "Incident " + eventNumber + " deleted successfully"})
          invalidateEventCaches();
        } else {
          res.status(404).json({message: "Incident " + eventNumber + " not found unable to be deleted"})
      }
      }
      } catch(error: any) {
        console.error("Error deleting incident", error)
        res.status(500).json({
          message: "Error unable to delete incident please try again later"
        })
      }


      
  }
  app.delete('/api/attendance/deleteIncident', limit.incidentCreateLimiter, requireRoleAssignmentPin,  sanitise.sanitizeEventNumberQuery, deleteIncident)

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
            eventType: "incident",
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
            eventType: { $ne: "incident" },
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
  app.get('/api/attendance/listEvents', limit.eventListLimiter, requireRoleAssignmentPin, listEvents)

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

  const roleReportRun: RequestHandler = async (req, res) => {
    try {
      const { startEpoch, endEpoch, names, roles } = req.body;

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

      if (Array.isArray(names) && names.length > 0) {
        query.name = {
          $in: names,
        };
      }

      if (Array.isArray(roles) && roles.length > 0) {
        query.roles = {
          $exists: true,
          $ne: [],
          $in: roles,
        };
      }

      const MAX_ROWS = 50000;

      const records = await recordsCollection
        .find(
          query,
          {
            projection: {
              _id: 0,
              name: 1,
              eventNumber: 1,
              operational: 1,
              activity: 1,
              roles: 1,
              epochTimestamp: 1,
            },
          }
        )
        .limit(MAX_ROWS + 1)
        .toArray();

      if (records.length > MAX_ROWS) {
        return res.status(413).json({
          message: "Result too large. Narrow date range or selected members.",
        });
      }

      records.sort((a: any, b: any) => {
        const timeA = Number(a.epochTimestamp ?? 0);
        const timeB = Number(b.epochTimestamp ?? 0);

        if (timeA !== timeB) return timeA - timeB;

        return String(a.name ?? "").localeCompare(String(b.name ?? ""));
      });

      const dto = records.map((record: any) => ({
        name: record.name,
        eventNumber: record.eventNumber ?? "",
        operational: record.operational ?? "",
        activity: record.activity ?? "",
        roles: Array.isArray(record.roles) ? record.roles : [],
        epochTimestamp: record.epochTimestamp,
        timestampLocal: moment
          .tz(record.epochTimestamp, "Australia/Sydney")
          .format("DD-MM-YYYY HH:mm"),
      }));

      return res.status(200).json({
        count: dto.length,
        records: dto,
      });
    } catch (error) {
      console.error("Error running role report:", error);

      return res.status(500).json({
        message: "Failed to run role report.",
      });
    }
  };
  app.post("/api/reports/roles/run", limit.reportRunLimiter, requireAdmin, sanitise.sanitizeRoleReportRunInput, roleReportRun);

  const roleReportExport: RequestHandler = async (req, res) => {
    try {
      const {
        startEpoch,
        endEpoch,
        names,
        formattedStart,
        formattedEnd,
      } = req.body;

      const query: any = {
        epochTimestamp: {
          $gte: startEpoch,
          $lte: endEpoch,
        },
        name: {
          $in: names,
        },
        roles: {
          $exists: true,
          $ne: [],
        },
      };

      const MAX_ROWS = 50000;

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
          message: "No role records found to export.",
        });
      }

      if (records.length > MAX_ROWS) {
        return res.status(413).json({
          message: "Result too large. Narrow date range or selected members.",
        });
      }

      records.sort((a: any, b: any) => {
        const timeA = Number(a.epochTimestamp ?? 0);
        const timeB = Number(b.epochTimestamp ?? 0);

        if (timeA !== timeB) return timeA - timeB;

        return String(a.name ?? "").localeCompare(String(b.name ?? ""));
      });

      const rows: XlsxRow[] = [
        [
          "Date/Time",
          "Name",
          "Event Number",
          "Operational",
          "Activity",
          "Roles",
        ],
        ...records.map((record: any) => [
          moment
            .tz(record.epochTimestamp, "Australia/Sydney")
            .format("DD-MM-YYYY HH:mm"),
          record.name ?? "",
          record.eventNumber ?? "",
          record.operational ?? "",
          record.activity ?? "",
          Array.isArray(record.roles) ? record.roles.join(", ") : "",
        ]),
      ];

      const fallbackFormat = (epoch: number) =>
        new Date(epoch).toISOString().slice(0, 10).replace(/-/g, "");

      const fileStart = formattedStart || fallbackFormat(startEpoch);
      const fileEnd = formattedEnd || fallbackFormat(endEpoch);

      const filename = `role-report-${fileStart}-${fileEnd}.xlsx`;

      await sendXlsxResponse(res, filename, rows);
      return;
    } catch (error) {
      console.error("Error exporting role report:", error);

      return res.status(500).json({
        message: "Failed to export role report.",
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
