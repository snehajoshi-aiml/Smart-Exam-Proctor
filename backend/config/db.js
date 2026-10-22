const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URL || 'mongodb://127.0.0.1:27017/smart-proctoring';
    console.log(`🔌 [MongoDB] Attempting connection to: ${mongoUri}...`);

    // Register Mongoose Connection Debug Listeners
    mongoose.connection.removeAllListeners();
    mongoose.connection.on('connected', () => {
      console.log('✅ [MongoDB Debug] Mongoose default connection open');
    });
    mongoose.connection.on('error', (err) => {
      console.error('❌ [MongoDB Debug] Mongoose default connection error:', err.message);
    });
    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ [MongoDB Debug] Mongoose default connection disconnected');
    });

    const conn = await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`✅ [MongoDB] Connected Successfully to Host: ${conn.connection.host} [DB: ${conn.connection.name}]`);
    return conn;
  } catch (error) {
    console.error(`❌ [MongoDB] Connection Failed (${error.message}). Operating in High-Availability In-Memory Fallback Mode.`);
    return null;
  }
};

module.exports = connectDB;
