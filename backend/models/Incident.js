const mongoose = require('mongoose');

const incidentSchema = new mongoose.Schema({
    incidentId: {
        type: String,
        default: () => 'INC_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5)
    },
    studentId: {
        type: String,
        required: true,
        index: true
    },
    fullName: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        index: true
    },
    screenshot: {
        type: String, // base64 string
        default: null
    },
    reason: {
        type: String,
        required: true,
        default: 'Face Mismatch'
    },
    confidence: {
        type: Number,
        default: 0
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

incidentSchema.index({ studentId: 1, timestamp: -1 });

module.exports = mongoose.models.Incident || mongoose.model('Incident', incidentSchema);
