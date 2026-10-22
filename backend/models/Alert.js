const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  alertId: {
    type: String,
    required: true,
    unique: true
  },
  sessionId: {
    type: String,
    required: true
  },
  studentId: {
    type: String,
    required: true
  },
  studentName: {
    type: String,
    required: true
  },
  examName: {
    type: String,
    required: true
  },
  alertType: {
    type: String,
    required: true,
    enum: [
      'MOBILE_PHONE_DETECTED',
      'MULTIPLE_FACES',
      'STUDENT_LEFT_CAMERA',
      'TAB_SWITCHING',
      'BROWSER_MINIMIZED',
      'LOOKING_AWAY_CONTINUOUSLY',
      'INTERNET_DISCONNECTED'
    ]
  },
  message: {
    type: String,
    required: true
  },
  severity: {
    type: String,
    enum: ['Warning', 'High', 'Critical'],
    default: 'High'
  },
  isRead: {
    type: Boolean,
    default: false
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  collection: 'alerts'
});

alertSchema.index({ alertId: 1 });
alertSchema.index({ sessionId: 1 });
alertSchema.index({ isRead: 1 });
alertSchema.index({ timestamp: -1 });

module.exports = mongoose.models.Alert || mongoose.model('Alert', alertSchema);
