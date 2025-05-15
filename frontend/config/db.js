const { MongoClient } = require('mongodb');

let db;

async function connectDB() {
  try {
    const client = await MongoClient.connect(process.env.COSMOS_DB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    db = client.db('JRFBLogin');  // Your DB name
    console.log('Database connected successfully');
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  }
}

function getDB() {
  if (!db) {
    throw new Error('Database not connected!');
  }
  return db;
}

module.exports = { connectDB, getDB };
