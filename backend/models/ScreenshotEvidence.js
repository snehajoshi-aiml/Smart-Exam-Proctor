const mongoose = require('mongoose');

const screenshotEvidenceSchema = new mongoose.Schema({
    activityId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SuspiciousActivity',
        required: true
    },
    sessionId: {
        type: String,
        required: true
    },
    studentId: {
        type: String,
        required: true
    },
    imageBase64: {
        type: String,
        required: true
    },
    mimeType: {
        type: String,
        default: 'image/jpeg'
    },
    fileSizeKb: {
        type: Number,
        default: 0
    },
    savedAt: {
        type: Date,
        default: Date.now
    },
    bucket: {
        type: String,
        enum: ['local', 's3', 'gcs'],
        default: 'local'
    },
    localPath: {
        type: String,
        default: null
    }
}, { timestamps: true });

screenshotEvidenceSchema.index({ sessionId: 1 });
screenshotEvidenceSchema.index({ studentId: 1 });

module.exports = mongoose.model('ScreenshotEvidence', screenshotEvidenceSchema);
