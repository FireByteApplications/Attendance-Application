import express, { Request, Response } from 'express';
import cors, { CorsOptions } from 'cors';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { expressjwt } from 'express-jwt';
import jwksRsa from 'jwks-rsa';
import validator from 'validator'; 
import ExcelJS from 'exceljs';

dotenv.config();

const app = express();
const port = process.env.PORT || 8080;
const cosmosDbUri = process.env.COSMOS_DB_URI;
const secretKey = process.env.JWT_SECRET!;

const corsOptions: CorsOptions = {
  origin: [],
  methods: 'POST',
  credentials: true,
};
const checkJwt = expressjwt({
  secret: jwksRsa.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksUri: `https://login.microsoftonline.com/${process.env.TENANT_ID}/discovery/v2.0/keys`,
  }),
  audience: process.env.CLIENT_ID, // your Azure AD App registration client ID
  issuer: `https://login.microsoftonline.com/${process.env.TENANT_ID}/v2.0`,
  algorithms: ['RS256'],
});

if (process.env.NODE_ENV === 'development') {
  corsOptions.origin = ['https://localhost:443', 'https://127.0.0.1:443'];
} else if (process.env.NODE_ENV === 'production') {
  corsOptions.origin = ['https://ashy-ocean-0062f3f00.5.azurestaticapps.net'];
}

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json());

if (!cosmosDbUri) {
  throw new Error('URI is not defined in the environment variables.');
}

const client = new MongoClient(cosmosDbUri);
client.connect().then(() => {
  const db = client.db('JRFBLogin');
  const usersCollection = db.collection('Usernames');
  const recordsCollection = db.collection('Records');

  function sanitizeName(str: string) {
    return str.toLowerCase().replace(/-/g, '').replace(/\s+/g, '').trim();
  }

  function sanitizeOptions(str: string) {
    return str.replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
  }

  app.post('/api/addUser', checkJwt, async (req: Request, res: Response) => {
    let { firstName, lastName, fireZoneNumber, Status, Classification, Type, honeypot } = req.body;

    if (honeypot) return res.status(400).json({ message: 'Bot detected, form submission blocked' });

    if (!firstName || !lastName || !fireZoneNumber || !Status || !Classification || !Type) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    firstName = sanitizeName(firstName);
    lastName = sanitizeName(lastName);
    Status = sanitizeOptions(Status);
    Classification = sanitizeOptions(Classification);
    Type = sanitizeOptions(Type);

    const nameRegex = /^[a-z\s]+$/;
    if (!nameRegex.test(firstName) || !nameRegex.test(lastName)) {
      return res.status(400).json({ message: 'Fields can only contain letters and spaces' });
    }

    const fireZoneRegex = /^[1-9]+$/;
    if (!fireZoneRegex.test(fireZoneNumber)) {
      return res.status(400).json({ message: 'Fire zone number must only contain numbers 1-9' });
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
    } catch (error) {
      console.error('Error adding user', error);
      res.status(500).json({ message: 'Failed to add user' });
    }
  });

  app.post('/login', checkJwt, async (req: Request, res: Response) => {
    try {
      const { username } = req.body;

      function sanitizeUsername(username: string): string {
        const sanitized = username.trim().toLowerCase();
        if (sanitized.length < 3 || sanitized.length > 20) throw new Error('Invalid username length.');
        if (/^[a-z.]+$/.test(sanitized)) return sanitized;
        throw new Error('Invalid username. Only letters and full stops are allowed');
      }

      const sanitizedUsername = sanitizeUsername(username);
      const user = await usersCollection.findOne({ username: sanitizedUsername });

      if (!user) return res.status(401).json({ success: false, message: 'Authentication failed' });

      const token = jwt.sign({ username: user.username }, secretKey, { expiresIn: '1h' });
      res.status(200).json({ success: true, token });
    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ success: false, message: 'An error occurred' });
    }
  });

  app.post('/submit', checkJwt, async (req: Request, res: Response) => {
    const { name, operational, activity, epochTimestamp } = req.body;
    const sanitizedName = validator.trim(name);
    const sanitizedOperational = validator.trim(operational);
    const sanitizedActivity = validator.trim(activity);

    if (!/^[a-zA-Z0-9\s]+$/.test(sanitizedName) || !/^[a-zA-Z0-9\s-]+$/.test(sanitizedOperational) || !/^[a-zA-Z0-9\s-]+$/.test(sanitizedActivity)) {
      return res.status(400).json({ message: 'Invalid characters in input fields' });
    }

    const epochTimestampNumber = Number(epochTimestamp);
    if (!Number.isInteger(epochTimestampNumber) || epochTimestampNumber <= 0) {
      return res.status(400).json({ message: 'Invalid epochTimestamp' });
    }

    try {
      const result = await recordsCollection.insertOne({
        name: sanitizedName,
        operational: sanitizedOperational,
        activity: sanitizedActivity,
        epochTimestamp: epochTimestampNumber,
      });
      res.status(200).json({ message: 'Data submitted successfully', result });
    } catch (error) {
      console.error('Error submitting data', error);
      res.status(500).json({ message: 'Failed to submit data' });
    }
  });

  app.post('/api/names', checkJwt, async (req: Request, res: Response) => {
    const { query } = req.body;
    try {
      const names = await usersCollection.find({ username: { $regex: query, $options: 'i' } }, { projection: { username: 1, _id: 0 } }).toArray();
      res.status(200).json(names.map(user => user.username));
    } catch (error) {
      console.error('Error fetching names', error);
      res.status(500).json({ message: 'Failed to fetch names' });
    }
  });

  app.post('/api/users/delete', checkJwt, async (req: Request, res: Response) => {
    const { numbers } = req.body;
    if (!Array.isArray(numbers) || numbers.length === 0) {
      return res.status(400).json({ message: 'Missing fire zone numbers' });
    }
    const fireZoneRegex = /^[1-9]+$/;
    const invalidNumbers = numbers.filter(num => !fireZoneRegex.test(num));
    if (invalidNumbers.length > 0) {
      return res.status(400).json({ message: `Invalid fire zone numbers: ${invalidNumbers.join(', ')}` });
    }

    try {
      const deleteResult = await usersCollection.deleteMany({ number: { $in: numbers } });
      if (deleteResult.deletedCount === 0) {
        return res.status(404).json({ message: 'No users found with those fire zone numbers' });
      }
      res.status(200).json({ message: `${deleteResult.deletedCount} user(s) deleted successfully` });
    } catch (error) {
      console.error('Error deleting users', error);
      res.status(500).json({ message: 'Failed to delete users' });
    }
  });

  app.post('/api/reports/run', checkJwt, async (req: Request, res: Response) => {
    const { startEpoch, endEpoch, name, activity, operational } = req.body;
    try {
      const query: any = { epochTimestamp: { $gte: startEpoch, $lte: endEpoch } };
      if (name) query.name = name;
      if (activity) query.activity = activity;
      if (operational) query.operational = operational;
      const result = await recordsCollection.find(query).toArray();
      res.status(200).json({ count: result.length, records: result });
    } catch (error) {
      console.error("Unable to fetch records", error);
      res.status(500).json({ message: "Unable to fetch records" });
    }
  });

  app.post('/api/reports/export', checkJwt, async (req: Request, res: Response) => {
    const { startEpoch, endEpoch, name, activity, operational, includeZeroAttendance, formattedStart, formattedEnd } = req.body;
    try {
      const query: any = { epochTimestamp: { $gte: startEpoch, $lte: endEpoch } };
      if (name) query.name = name;
      if (activity) query.activity = activity;
      if (operational) query.operational = operational;
      const records = await recordsCollection.find(query).toArray();

      const userDataMap = new Map<string, any>();
      const usersWithRecords = new Set<string>();

      for (const record of records) {
        const userName = record.name;
        usersWithRecords.add(userName);

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
              nonOperationalActivities: 0
            });
          }
        }

        const userStats = userDataMap.get(userName);
        if (userStats) {
          if (record.operational === "Operational") userStats.operationalActivities++;
          else if (record.operational === "Non-Operational") userStats.nonOperationalActivities++;
        }
      }

      if (includeZeroAttendance) {
        const allUsers = await usersCollection.find({}).toArray();
        for (const user of allUsers) {
          if (!usersWithRecords.has(user.id)) {
            userDataMap.set(user.id, {
              name: user.id,
              memberNumber: user.number || '',
              status: user.member_status,
              Membership_Classification: user.membership_classification,
              membership_type: user.membership_type,
              operationalActivities: 0,
              nonOperationalActivities: 0
            });
          }
        }
      }

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Report');
      worksheet.addRow(['Name', 'Member number', 'Status', 'Membership Classification', 'membership_type', 'Operational activities', 'Non-operational activities']);

      for (const [, user] of userDataMap) {
        worksheet.addRow([
          user.name,
          user.memberNumber,
          user.status,
          user.Membership_Classification,
          user.membership_type,
          user.operationalActivities,
          user.nonOperationalActivities
        ]);
      }

      const fallbackFormat = (epoch: number) => new Date(epoch).toISOString().slice(0, 10).replace(/-/g, '');
      const fileStart = formattedStart || fallbackFormat(startEpoch);
      const fileEnd = formattedEnd || fallbackFormat(endEpoch);
      const filename = `member-attendance-report-${fileStart}-${fileEnd}.xlsx`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      console.error("Error generating Excel report", error);
      res.status(500).json({ error: "Failed to export report" });
    }
  });

  app.post('/api/updateUser', checkJwt, async (req: Request, res: Response) => {
    const { name, oldfzNumber, fzNumber, memberStatus, memberClassification, memberType } = req.body;
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
      const updatedRecord = await usersCollection.findOneAndUpdate(
        { number: oldfzNumber },
        { $set: updatedUser },
        { returnDocument: 'after' }
      );
      if (updatedRecord) {
        res.status(200).json({ success: true, updatedRecord });
      } else {
        res.status(404).json({ success: false, message: 'Record not found.' });
      }
    } catch (error) {
      console.error('Error updating record:', error);
      res.status(500).json({ success: false, message: 'An error occurred while updating the record.' });
    }
  });

  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}).catch((err) => {
  console.error('Failed to connect to database:', err);
});
