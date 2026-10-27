const mongoose = require('mongoose');

const DB_NAME = 'hirelens_ai';

async function connectDB(uri = process.env.MONGODB_URI) {
  if (!uri) throw new Error('MONGODB_URI is not set');
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { dbName: DB_NAME, serverSelectionTimeoutMS: 10000 });
  return mongoose.connection;
}

const STATES = ['disconnected', 'connected', 'connecting', 'disconnecting'];
const dbState = () => STATES[mongoose.connection.readyState] || 'unknown';

module.exports = { connectDB, dbState, DB_NAME };
