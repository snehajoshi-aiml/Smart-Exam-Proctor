const mongoose = require('mongoose');

const GazeEventSchema = new mongoose.Schema({
  studentId: {
    type: String,
    required: true,
    index: true,
    trim: true
  },
  examId: {
    type: String,
    required: true,
    index: true,
    trim: true
  },
  sessionId: {
    type: String,
    required: true,
    index: true,
    trim: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  gazeDirection: {
    type: String,
    required: true,
    enum: ['CENTER', 'LEFT', 'RIGHT', 'UP', 'DOWN', 'BLINKING', 'UNKNOWN']
  },
  headPose: {
    yaw: { type: Number, default: 0 },
    pitch: { type: Number, default: 0 },
    roll: { type: Number, default: 0 }
  },
  duration: {
    type: Number,
    required: true, // Duration in seconds
    default: 0
  },
  suspicionScore: {
    type: Number,
    default: 0
  },
  riskLevel: {
    type: String,
    enum: ['NORMAL', 'SUSPICIOUS', 'WARNING', 'HIGH RISK', 'HIGH_RISK'],
    default: 'NORMAL'
  },
  eventType: {
    type: String,
    enum: ['GAZE_DEVIATION', 'PROLONGED_AWAY', 'ATTENTION_RESTORED', 'REPEATED_DEVIATION'],
    default: 'GAZE_DEVIATION'
  },
  confidence: {
    type: Number,
    default: 90
  },
  interactionContext: {
    wasInteracting: { type: Boolean, default: false },
    lastInteractionType: { type: String, default: 'none' }
  }
}, { timestamps: true });

// Compound indexes for optimal session timeline and reporting queries
GazeEventSchema.index({ studentId: 1, examId: 1, timestamp: -1 });
GazeEventSchema.index({ sessionId: 1, timestamp: -1 });

module.exports = mongoose.models.GazeEvent || mongoose.model('GazeEvent', GazeEventSchema);
