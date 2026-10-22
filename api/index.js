const app = require('../backend/server');

module.exports = async (req, res) => {
  if (app.connectDB) {
    try {
      await app.connectDB();
    } catch (err) {
      console.warn('⚠️ Serverless MongoDB connection notice:', err.message);
    }
  }
  return app(req, res);
};

