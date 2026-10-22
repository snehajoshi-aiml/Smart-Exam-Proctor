const mongoose = require('mongoose');

const violationSchema = new mongoose.Schema({
  violationId: {
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
  type: {
    type: String,
    required: true,
    enum: [
      'MOBILE_PHONE_DETECTED',
      'MULTIPLE_FACES_DETECTED',
      'NO_FACE_DETECTED',
      'LOOKING_AWAY',
      'TAB_SWITCHED',
      'FULLSCREEN_EXITED',
      'COPY_PASTE_ATTEMPT',
      'INTERNET_DISCONNECTED',
      'SUSPICIOUS_HEAD_MOVEMENT',
      'AUDIO_ANOMALY',
      'DEV_TOOLS_OPENED'
    ]
  },
  description: {
    type: String,
    required: true
  },
  severity: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Critical'],
    default: 'Medium'
  },
  screenshotUrl: {
    type: String,
    default: ''
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  collection: 'violations'
});

violationSchema.index({ violationId: 1 });
violationSchema.index({ sessionId: 1 });
violationSchema.index({ studentId: 1 });
violationSchema.index({ type: 1 });
violationSchema.index({ timestamp: -1 });

module.exports = mongoose.models.Violation || mongoose.model('Violation', violationSchema);
