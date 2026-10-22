const mongoose = require('mongoose');

const cheatingLogSchema = new mongoose.Schema({
    sessionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ExamSession',
        required: true
    },
    type: {
        type: String,
        enum: ['tab_switch', 'phone_detected', 'suspicious_audio', 'exam_terminated', 'warning', 'face_not_visible', 'multiple_faces'],
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now,
        required: true
    },
    details: {
        tabSwitchCount: Number,
        reason: String,
        audioLevel: Number,
        confidence: Number,
        imageUrl: String,
        metadata: mongoose.Schema.Types.Mixed
    },
    severity: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'medium'
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('CheatingLog', cheatingLogSchema);