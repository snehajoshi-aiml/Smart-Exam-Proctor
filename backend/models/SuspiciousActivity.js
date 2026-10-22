const mongoose = require('mongoose');

const suspiciousActivitySchema = new mongoose.Schema({
    studentId: {
        type: String,
        required: true,
        ref: 'Student'
    },
    sessionId: {
        type: String,
        required: false,
        default: () => `sess_${Date.now()}`
    },
    studentEmail: {
        type: String,
        default: null
    },
    examId: {
        type: String,
        default: 'CS_EXAM_FINAL'
    },
    violationType: {
        type: String,
        default: null
    },
    warningNumber: {
        type: Number,
        default: 0
    },
    screenshotPath: {
        type: String,
        default: null
    },
    type: {
        type: String,
        required: true
    },
    confidence: {
        type: Number,
        min: 0,
        max: 1,
        default: null
    },
    description: {
        type: String,
        default: ''
    },
    screenshotUrl: {
        type: String,
        default: null
    },
    screenshotBase64: {
        type: String,
        default: null
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    severity: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'medium'
    }
}, { timestamps: true });

// Index for fast querying by session
suspiciousActivitySchema.index({ sessionId: 1, timestamp: -1 });
suspiciousActivitySchema.index({ studentId: 1, timestamp: -1 });

module.exports = mongoose.model('SuspiciousActivity', suspiciousActivitySchema);
