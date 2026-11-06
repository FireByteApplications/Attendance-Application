import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';

dotenv.config();

const definitions = {
  Records: [
    { name: 'report_time_id', key: { epochTimestamp: 1, _id: 1 } },
    { name: 'role_report_time_name_id', key: { epochTimestamp: 1, name: 1, _id: 1 } },
    { name: 'attendance_event_number', key: { eventNumber: 1 } },
  ],
  Events: [
    { name: 'event_date_desc', key: { eventDate: -1 } },
    { name: 'event_type_date_desc', key: { eventType: 1, eventDate: -1 } },
    { name: 'event_number', key: { eventNumber: 1 } },
  ],
};

const apply = process.argv.includes('--apply');
if (!process.env.COSMOS_DB_URI || !process.env.DB_NAME) {
  throw new Error('COSMOS_DB_URI and DB_NAME are required');
}

const client = new MongoClient(process.env.COSMOS_DB_URI);
try {
  await client.connect();
  const database = client.db(process.env.DB_NAME);
  for (const [collectionName, expected] of Object.entries(definitions)) {
    const collection = database.collection(collectionName);
    const existing = await collection.indexes();
    for (const definition of expected) {
      const match = existing.find((index) =>
        JSON.stringify(index.key) === JSON.stringify(definition.key));
      if (match) {
        console.log(`${collectionName}: ${definition.name} exists as ${match.name}`);
      } else if (apply) {
        await collection.createIndex(definition.key, { name: definition.name });
        console.log(`${collectionName}: created ${definition.name}`);
      } else {
        console.log(`${collectionName}: missing ${definition.name} ${JSON.stringify(definition.key)}`);
      }
    }
  }
} finally {
  await client.close();
}
