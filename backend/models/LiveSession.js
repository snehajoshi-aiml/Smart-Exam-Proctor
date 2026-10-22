const mongoose = require('mongoose');

const liveSessionSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true
  },
  studentId: {
    type: String,
    required: true
  },
  studentName: {
    type: String,
    required: true
  },
  usn: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  examId: {
    type: String,
    default: 'EXAM-101'
  },
  examName: {
    type: String,
    default: 'Computer Science Final Assessment'
  },
  department: {
    type: String,
    default: 'Computer Science & Engineering'
  },
  startTime: {
    type: Date,
    default: Date.now
  },
  durationMinutes: {
    type: Number,
    default: 180
  },
  remainingTime: {
    type: Number, // in seconds or string
    default: 10800
  },
  status: {
    type: String,
    enum: ['Online', 'Offline', 'Completed', 'Finished', 'Terminated', 'Warning', 'Active', 'in-progress'],
    default: 'Online'
  },
  score: {
    type: Number,
    default: 0
  },
  answers: {
    type: mongoose.Schema.Types.Mixed,
    default: []
  },
  mcqStats: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  codingStats: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  theoryStats: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  lastWebcamFrame: {
    type: String,
    default: ''
  },

  // Real-time Proctoring Indicators
  faceDetected: {
    type: Boolean,
    default: true
  },
  multipleFaces: {
    type: Boolean,
    default: false
  },
  mobilePhoneDetected: {
    type: Boolean,
    default: false
  },
  headPose: {
    type: String,
    default: 'Normal' // Normal, Looking Left, Looking Right, Looking Up, Looking Down, Tilted
  },
  eyeGaze: {
    type: String,
    default: 'Center' // Center, Left, Right, Off-screen
  },
  tabSwitchingCount: {
    type: Number,
    default: 0
  },
  copyPasteAttempts: {
    type: Number,
    default: 0
  },
  fullScreenStatus: {
    type: String,
    enum: ['Active', 'Exited'],
    default: 'Active'
  },
  internetStatus: {
    type: String,
    enum: ['Online', 'Offline'],
    default: 'Online'
  },
  suspiciousActivityCount: {
    type: Number,
    default: 0
  },
  riskLevel: {
    type: String,
    enum: ['Low', 'Medium', 'High'],
    default: 'Low'
  },

  // Extended Telemetry for Detail Page
  faceConfidence: {
    type: Number,
    default: 0.95
  },
  objectDetectionResults: [{
    label: String,
    confidence: Number,
    timestamp: { type: Date, default: Date.now }
  }],
  headMovementHistory: [{
    pose: String,
    pitch: Number,
    yaw: Number,
    roll: Number,
    timestamp: { type: Date, default: Date.now }
  }],
  eyeTrackingHistory: [{
    gaze: String,
    x: Number,
    y: Number,
    timestamp: { type: Date, default: Date.now }
  }],
  browserActivity: [{
    action: String,
    details: String,
    timestamp: { type: Date, default: Date.now }
  }],
  screenshotsCaptured: [{
    url: String,
    reason: String,
    timestamp: { type: Date, default: Date.now }
  }],
  eventLogs: [{
    event: String,
    severity: String,
    details: String,
    timestamp: { type: Date, default: Date.now }
  }],
  aiDetectionEvents: [{
    eventType: String,
    description: String,
    confidence: Number,
    timestamp: { type: Date, default: Date.now }
  }],

  lastActive: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  collection: 'live_sessions'
});

liveSessionSchema.index({ sessionId: 1 });
liveSessionSchema.index({ studentId: 1 });
liveSessionSchema.index({ status: 1 });

module.exports = mongoose.models.LiveSession || mongoose.model('LiveSession', liveSessionSchema);
