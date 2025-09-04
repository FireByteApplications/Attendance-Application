import express, { RequestHandler, Request, Response, NextFunction} from 'express';
import cors, { CorsOptions } from 'cors';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import fetch, { RequestInit as FetchRequestInit } from 'node-fetch';
import ExcelJS from 'exceljs';
import moment from 'moment-timezone';
import crypto from 'crypto';
import { URL, URLSearchParams } from 'url';
import { requireAdmin } from './middleware/requireadmin';
import { csrfMiddleware} from './middleware/csrfToken';
import escapeStringRegexp from 'escape-string-regexp';
import helmet from 'helmet';
import { promisify } from 'util';
import { authLimiter, attendanceLimiter, adminLimiter } from './middleware/rateLimit';
import MongoStore from 'connect-mongo';
import { sanitizeAttendanceInput, sanitizeUpdatedUser, sanitizeUser } from './middleware/sanitiseInputs'

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
const corsOptions: CorsOptions = {
  origin: [],
  methods: ['POST', 'GET'],
  credentials: true,
};
corsOptions.allowedHeaders = ['Content-Type','X-CSRF-Token']
if (process.env.NODE_ENV === 'development') {
  corsOptions.origin = true
} else if (process.env.NODE_ENV === 'production') {
  corsOptions.origin = [`${FRONTEND_URL}`];
}
app.use(cors(corsOptions));
app.use(express.json());
import session from 'express-session';

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
      secure: true,
      sameSite: 'none',
      maxAge: 60 * 60 * 1000, //1 hour
    },
  }),
);

app.disable('x-powered-by');

app.set('trust proxy', 1);

app.use(csrfMiddleware);

app.use(['/api/attendance'], attendanceLimiter)
app.use(['/api/users', '/api/reports'], adminLimiter)

app.use(helmet()); app.use(helmet.hsts({ maxAge: 15552000, preload:true }));

app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'none'"],      // API should not serve HTML assets
      frameAncestors: ["'none'"],
    },
  })
)

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

  app.get('/csrf-token', (req, res) => {
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
  app.get('/auth/login', authLimiter, login)

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

      /* store user data on the fresh session */
      req.session.user = {
        email: profile.mail ?? profile.userPrincipalName,
        name: profile.displayName,
        id: profile.id,
        isAdmin,
      };
      req.session.cookie.maxAge = 60 * 60 * 1000; // 1 hour

      /* 5. persist & redirect */
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
  app.get('/auth/redirect', authLimiter, redirect)

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
  app.get('/auth/check', AuthCheck)

  const sessionCheck: RequestHandler = (req, res) => {
      if (req.session?.user) return res.sendStatus(200);
    res.sendStatus(401);

  }
  app.get('/auth/session', sessionCheck)

  const LogOut: RequestHandler = (req, res) => {
    req.session.destroy(() => {
        res.clearCookie('connect.sid'); // The session cookie, if using express-session

        // Optionally, also log out from Microsoft
        // Construct a post_logout_redirect_uri to send the user back to your frontend
        const postLogoutRedirect = encodeURIComponent(process.env.POST_LOGOUT_URL!);
        const logoutUrl =
          `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/oauth2/v2.0/logout?post_logout_redirect_uri=${postLogoutRedirect}`;

        // Redirect user to Microsoft logout (logs them out of Azure, then returns to your site)
        res.redirect(logoutUrl);
      });
  };
  app.get('/auth/logout', authLimiter, LogOut)


  const getUsersList: RequestHandler = async (req, res) => {
    const authedReq = req as AuthedRequest;
    authedReq.user = authedReq.session.user;
    try {
      const users = await usersCollection.find({}).toArray();
      res.status(200).json(users);
      return;
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ message: 'Failed to fetch users' });
      return;
    }
  };
  app.get('/api/users/list', requireAdmin, getUsersList);


  const UserNames: RequestHandler = async (req, res) => {
    const authedReq = req as AuthedRequest;
    authedReq.user = authedReq.session.user;
    try {
      const users = await usersCollection.find({}, { projection: { id: 1, _id: 0 } }).toArray();
      res.status(200).json(users);
      return;
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch user names" });
      return;
    }
  };
  app.get('/api/users/names', requireAdmin, UserNames)


  const addUser: RequestHandler = async (req, res) => {
    const authedReq = req as AuthedRequest;
    authedReq.user = authedReq.session.user;
  const { firstName, lastName, fireZoneNumber, Status, Classification, Type, honeypot, middleName } = req.body;

    if (honeypot || middleName) res.status(400).json({ message: 'Bot detected, form submission blocked' });

    if (!firstName || !lastName || !fireZoneNumber || !Status || !Classification || !Type) {
    res.status(400).json({ message: 'Missing required fields' });
    return;
    }

    const id = `${firstName} ${lastName}`;
    const username = `${firstName}.${lastName}`;

    try {
      const result = await usersCollection.insertOne({
        id,
        username,
        number: fireZoneNumber,
        member_status: Status,
        membership_classification: Classification,
        membership_type: Type,
      });
      res.status(201).json({ message: 'User added successfully', result });
      return;
    } catch (error) {
      console.error('Error adding user', error);
      res.status(500).json({ message: 'Failed to add user' });
      return
    }
  };
  app.post('/api/users/addUser', sanitizeUser, requireAdmin, addUser)


  const deleteUser: RequestHandler = async (req, res) => {
    const authedReq = req as AuthedRequest;
    authedReq.user = authedReq.session.user;
    const { numbers } = req.body;
    if (!Array.isArray(numbers) || numbers.length === 0) {
      res.status(400).json({ message: 'Missing fire zone numbers' });
      return;
    }
    const fireZoneRegex = /^[1-9]+$/;
    const invalidNumbers = numbers.filter(num => !fireZoneRegex.test(num));
    if (invalidNumbers.length > 0) {
      res.status(400).json({ message: `Invalid fire zone numbers: ${invalidNumbers.join(', ')}` });
      return;
    }

    try {
      const deleteResult = await usersCollection.deleteMany({ number: { $in: numbers } });
      if (deleteResult.deletedCount === 0) {
        res.status(404).json({success: false, message: 'No users found with those fire zone numbers' });
        return;
      }
      res.status(200).json({success: true, message: `${deleteResult.deletedCount} user(s) deleted successfully` });
      return;
    } catch (error) {
      console.error('Error deleting users', error);
      res.status(500).json({ success: false, message: 'Failed to delete users' });
      return;
    }

  };
  app.post('/api/users/delete', requireAdmin, deleteUser)


  const updateUser: RequestHandler = async (req, res) => {
    const authedReq = req as AuthedRequest;
    authedReq.user = authedReq.session.user;
  const { oldname, name, oldfzNumber, fzNumber, memberStatus, memberClassification, memberType } = req.body;
      const [firstname, ...lastnameArr] = name.split(' ');
      const lastname = lastnameArr.join(' ');
      const updatedUser = {
        id: name,
        username: `${firstname}.${lastname}`,
        number: fzNumber,
        member_status: memberStatus,
        membership_classification: memberClassification,
        membership_type: memberType,
      };

      try {
        const updateUser = await usersCollection.findOneAndUpdate(
          { number: oldfzNumber },
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
          return res.status(200).json({
            success: true,
            message: "User and records updated.",
            updateUser,
            updateRecord,
          });
        }

        if (userOk && !recordOk) {
          // <-- your requested case: user updated, no records found
          return res.status(200).json({
            success: true,
            message: "User updated. No records found to update.",
            updateUser,
            updateRecord,
          });
        }

        if (!userOk && recordOk) {
          // You can choose 200 (partial success) or 404 (user not found). 200 is friendlier.
          return res.status(200).json({
            success: true,
            partial: true,
            message: "Records updated, but user not found/updated.",
            updateUser,
            updateRecord,
          });
        }

        // Neither update happened
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
  app.post('/api/users/updateRecord', sanitizeUpdatedUser, requireAdmin, updateUser)


  const reportRun: RequestHandler = async (req, res) => {
    const authedReq = req as AuthedRequest;
    authedReq.user = authedReq.session.user;
  const {
      startEpoch,
      endEpoch,
      name,
      activity,
      operational,
      deploymentType,
      deploymentLocation,
      baType,
      chainsawType
    } = req.body;

    try {
      const MAX_SPAN = 365 * 24 * 60 * 60 * 1000; // 1 year ms
    if (endEpoch - startEpoch > MAX_SPAN) {
      res.status(400).json({ message: 'Date range too large (max 1 year)' });
      return;
    }

    const query: any = {
      epochTimestamp: { $gte: startEpoch, $lte: endEpoch },
    };

      if (name) query.name = name;
      if (activity) query.activity = activity;
      if (operational) query.operational = operational;

      if (activity === "Deployment") {
        if (deploymentType) query.deploymentType = deploymentType;
        if (deploymentLocation) query.deploymentLocation = deploymentLocation;
      }

      if (activity === "BA-Checks" && baType) {
        query.baType = baType;
      }

      if(activity == "Chainsaw-Checks" && chainsawType){
        query.chainsawType = chainsawType;
      }

      const result = await recordsCollection.find(query).toArray();

      const transformed = result.map(record => ({
        ...record,
        timestampLocal: moment.tz(record.epochTimestamp, 'Australia/Sydney').format('YYYY-MM-DD HH:mm')
      }));

      res.status(200).json({ count: transformed.length, records: transformed });
      return;
    } catch (error) {
      console.error('Unable to fetch records', (error as Error).message);
      res.status(500).json({ message: "Unable to fetch records" });
      return;
    }
  }
  app.post('/api/reports/run', requireAdmin, reportRun)


    const reportExport: RequestHandler = async (req, res) => {
    const authedReq = req as AuthedRequest;
    authedReq.user = authedReq.session.user;
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
      deploymentType,
      deploymentLocation,
      baType,
      chainsawType
    } = req.body;

    try {
        const query: any = {
          epochTimestamp: { $gte: startEpoch, $lte: endEpoch },
        };

        if (name) query.name = name;
        if (activity) query.activity = activity;
        if (operational) query.operational = operational;

        if (activity === "Deployment") {
          if (deploymentType) query.deploymentType = deploymentType;
          if (deploymentLocation) query.deploymentLocation = deploymentLocation;
        }

        if (activity === "BA-Checks" && baType) {
          query.baType = baType;
        }
        if (activity === "Chainsaw-Type" && chainsawType){
          query.chainsawType = chainsawType;
        }

        const MAX_ROWS = 50000;
        const recordsCursor = recordsCollection.find(query).limit(MAX_ROWS + 1);
        const records = await recordsCursor.toArray();
        if (records.length > MAX_ROWS) {
          res
          .status(413)
          .json({ error: 'Result too large. Narrow date range or filters.' });
          return;
        }
        const userDataMap = new Map<string, any>();
        const userNoAttendanceDataMap = new Map<string, any>();
        const usersWithRecords = new Set<string>();
        for (const record of records) {
          const userName = record.name;
          usersWithRecords.add(userName);
          if(detailed === false){
            if (!userDataMap.has(userName)) {
            const userDetails = await usersCollection.findOne({ id: userName });
            if (userDetails) {
              userDataMap.set(userName, {
                name: userName,
                memberNumber: userDetails.number || '',
                status: userDetails.member_status,
                Membership_Classification: userDetails.membership_classification,
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
                timestampLocal: moment.tz(record.epochTimestamp, 'Australia/Sydney').format('YYYY-MM-DD HH:mm'),
                operational: record.operational,
                activity: record.activity,
                ...(record.baType && { baType: record.baType }),
                ...(record.chainsawType && { chainsawType: record.chainsawType }),
                ...(record.deploymentType && { deploymentType: record.deploymentType }),
                ...(record.otherType && { otherType: record.otherType }),
                ...(record.deploymentLocation && { deploymentLocation: record.deploymentLocation }),
              });

              if (record.operational === "Operational") userStats.operationalActivities++;
              else if (record.operational === "Non-Operational") userStats.nonOperationalActivities++;
            }
            if (includeZeroAttendance) {
            const allUsers = await usersCollection.find({}).toArray();
            for (const user of allUsers) {
              if (!usersWithRecords.has(user.id)) {
                userNoAttendanceDataMap.set(user.id, {
                  name: user.id,
                  memberNumber: user.number || '',
                  status: user.member_status,
                  Membership_Classification: user.membership_classification,
                  membership_type: user.membership_type,
                  operationalActivities: 0,
                  nonOperationalActivities: 0,
                  records: []
                  });
                }
              } 
            }
          }
          else if(detailed === true){
            if (!userDataMap.has(userName)) {
            const userDetails = await usersCollection.findOne({ id: userName });
            if (userDetails) {
              userDataMap.set(userName, {
                name: userName,
                memberNumber: userDetails.number || '',
                status: userDetails.member_status,
                Membership_Classification: userDetails.membership_classification,
                membership_type: userDetails.membership_type,
                records: []
                });
              }
              
              }
            const userStats = userDataMap.get(userName);
            if (userStats) {
              userStats.records.push({
                timestampLocal: moment.tz(record.epochTimestamp, 'Australia/Sydney').format('YYYY-MM-DD HH:mm'),
                operational: record.operational,
                activity: record.activity,
                ...(record.baType && { baType: record.baType }),
                ...(record.chainsawType && { chainsawType: record.chainsawType }),
                ...(record.deploymentType && { deploymentType: record.deploymentType }),
                ...(record.otherType && { otherType: record.otherType }),
                ...(record.deploymentLocation && { deploymentLocation: record.deploymentLocation }),
              });
            }
            if (includeZeroAttendance) {
              const allUsers = await usersCollection.find({}).toArray();
              for (const user of allUsers) {
                if (!usersWithRecords.has(user.id)) {
                  console.log("!users with records has user id")
                  userNoAttendanceDataMap.set(user.id, {
                    name: user.id,
                    memberNumber: user.number || '',
                    status: user.member_status,
                    Membership_Classification: user.membership_classification,
                    membership_type: user.membership_type,
                    records: []
                  });
                }
              } 
            }
            }
        }

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Report');
        if(detailed === false){
          const header = [
          'Name',
          'Member number',
          'Status',
          'Membership Classification',
          'membership_type',
          'Operational activities',
          'Non-operational activities',
        ];
        worksheet.addRow(header);
        } else if(detailed === true){
          const header = [
          'Name',
          'Member number',
          'Status',
          'Membership Classification',
          'membership_type',
          'Operational',
          'Activity',
          'Activity Detail',
          'Activity Location',
          'timestamp'
        ];
        worksheet.addRow(header);
        }

        userDataMap.forEach((user: any) => {
          let row:(string | number)[] = []
          if(detailed === false){
            row = [
              user.name,
              user.memberNumber,
              user.status,
              user.Membership_Classification,
              user.membership_type,
              user.operationalActivities,
              user.nonOperationalActivities 
            ]
            worksheet.addRow(row)
          } else if(detailed === true) {
           for (const record of user.records) {
            let activityType = "";
            let activityLocation = "";
            if (record.activity === "BA-Checks") {
              activityType = record.baType || "";
            } else if (record.activity === "Chainsaw-Checks") {
              activityType = record.chainsawType || "";
            } else if (record.activity === "Other-Non-operational" || record.activity === "Other-operational") {
              activityType = record.otherType || "";
            } else if (record.activity === "Deployment") {
              activityType = record.deploymentType || "";
              activityLocation = record.deploymentLocation || "";
            }
            const row = [
              user.name,
              user.memberNumber,
              user.status,
              user.Membership_Classification,
              user.membership_type,
              record.operational,
              record.activity,
              activityType,
              activityLocation,
              record.timestampLocal
            ];
            worksheet.addRow(row);
          }
          userNoAttendanceDataMap.forEach((user: any) =>{
            let row:(string | number)[] = []
            row = [
              user.name,
              user.memberNumber,
              user.status,
              user.Membership_Classification,
              user.membership_type,
              "Zero Attendance"
            ]
            worksheet.addRow(row)
          })
        }
      });

      const fallbackFormat = (epoch: number) => new Date(epoch).toISOString().slice(0, 10).replace(/-/g, '');
      const fileStart = formattedStart || fallbackFormat(startEpoch);
      const fileEnd = formattedEnd || fallbackFormat(endEpoch);
      const filename = `member-attendance-report-${fileStart}-${fileEnd}.xlsx`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
      await workbook.xlsx.write(res);
      res.end();
      return;
    } catch (error) {
      console.error("Error generating Excel report", error);
      res.status(500).json({ error: "Failed to export report" });
      return;
    }
  }
  app.post('/api/reports/export', requireAdmin, reportExport)


  const CheckUsername: RequestHandler = async (req, res) => {
  try {
      const username = (req.query.u as string | undefined)?.trim() ?? '';
    if (username.length < 3 || username.length > 20 || !/^[a-zA-Z]+.?[a-zA-Z]+-?[a-zA-Z]+?$/.test(username)) {
      res.status(400).json({ ok: false, message: 'Invalid username' });
      return;
    }

    const exists = await usersCollection.findOne({ username });
      if (!exists){
        console.log(username)
        res.status(404).json({ ok: false });
        return;}
    req.session.validUsername = username;               // 🔑 remember validation in this session
    res.json({ ok: true });
  } catch (e) {
    console.error('checkUser error', e);
    res.status(500).json({ ok: false });  }
  };
  app.get('/api/attendance/checkUser', CheckUsername)

  // Session validation based on sanitized username
  const submitAttendance: RequestHandler = async (req, res) => {
  
  const spaceName = (req.body.name as string).trim();
  const dotName   = spaceName.replace(/\s+/g, '.');   

  if (req.session.validUsername !== dotName) {
    res.status(403).json({ message: 'Username not validated in this session' });
    return;
  }

  const {
    name,
    operational,
    activity,
    epochTimestamp,
    baType,
    chainsawType,
    deploymentType,
    deploymentLocation,
    otherType
  } = req.body;
  const record: any = {
    name,
    operational,
    activity,
    epochTimestamp
  };
  // Conditional data fields based on activity type
  if (activity === 'Chainsaw-Checks') {
    record.chainsawType = chainsawType;
  }

  if (activity === 'BA-Checks') {
    record.baType = baType;
  }

  if (activity === 'Deployment') {
    record.deploymentType = deploymentType;
    record.deploymentLocation = deploymentLocation;
  }
  if (activity === 'Other-Non-operational' || activity === 'Other-operational') {
    record.otherType = otherType;
  }

  try {
    const result = await recordsCollection.insertOne(record);
    res.status(200).json({ message: 'Data submitted successfully', result });
  } catch (error) {
    console.error('Error submitting data', error);
    res.status(500).json({ message: 'Failed to submit data' });
  }
};
  app.post('/api/attendance/submit', sanitizeAttendanceInput, submitAttendance)


  const listNames: RequestHandler = async (req, res) => {
  const query = (req.query.q as string | undefined) ?? '';
    const safeRegex = new RegExp('^' + escapeStringRegexp(query), 'i');

    const names = await usersCollection
      .find({ username: new RegExp('^' + escapeStringRegexp(query), 'i') }, { projection: { username: 1, _id: 0 } })
      .toArray();

    res.status(200).json(names.map((u) => u.username));
  };
  app.get('/api/attendance/usernameList',  listNames)

app.use(
  (err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Unhandled', err.message);
    res.status(500).json({ message: 'Internal server error' });
  },
);

  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}).catch((err) => {
  console.error('Failed to connect to database:', err);
});
