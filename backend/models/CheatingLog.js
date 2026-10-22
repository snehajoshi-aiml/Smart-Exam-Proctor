const mongoose = require('mongoose');

const cheatingLogSchema = new mongoose.Schema({
  studentId: {
    type: String,
    required: true,
    index: true
  },
  studentName: {
    type: String,
    required: true
  },
  usn: {
    type: String,
    default: 'N/A'
  },
  examId: {
    type: String,
    required: true,
    default: 'EXAM_ATHENA_001'
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  violationType: {
    type: String,
    required: true,
    enum: [
      'face_mismatch',
      'multiple_faces',
      'no_face_detected',
      'phone_detected',
      'earphones_detected',
      'looking_away',
      'tab_switch',
      'liveness_failed',
      'exam_terminated'
    ]
  },
  screenshot: {
    type: String, // Path or Base64
    default: null
  },
  faceImage: {
    type: String, // Path or Base64
    default: null
  },
  tabSwitchCount: {
    type: Number,
    default: 0
  },
  multipleFaceCount: {
    type: Number,
    default: 0
  },
  audioViolation: {
    type: Boolean,
    default: false
  },
  actionTaken: {
    type: String,
    default: 'Logged Violation'
  },
  terminated: {
    type: Boolean,
    default: false
  },
  euclideanDistance: {
    type: Number,
    default: null
  },
  confidence: {
    type: Number,
    default: null
  }
}, { timestamps: true });

module.exports = mongoose.models.CheatingLog || mongoose.model('CheatingLog', cheatingLogSchema);
