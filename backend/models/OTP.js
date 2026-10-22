const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true
  },
  studentName: {
    type: String,
    default: 'Student'
  },
  otpHash: {
    type: String,
    required: true
  },
  tokenHash: {
    type: String,
    required: false
  },
  attempts: {
    type: Number,
    default: 0
  },
  lastResendAt: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 300 // MongoDB TTL index: automatically deletes document after 5 minutes (300 seconds)
  }
}, {
  timestamps: true,
  collection: 'otps'
});

module.exports = mongoose.models.OTP || mongoose.model('OTP', otpSchema);
