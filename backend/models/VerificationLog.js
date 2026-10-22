const mongoose = require('mongoose');

const VerificationLogSchema = new mongoose.Schema({
    studentId: { type: String, required: true, index: true },
    email: { type: String, required: true, index: true },
    timestamp: { type: Date, default: Date.now },
    bestSimilarity: { type: Number, required: true },
    averageSimilarity: { type: Number, required: true },
    verifiedFrames: { type: Number, required: true },
    suspiciousFrames: { type: Number, required: true },
    rejectedFrames: { type: Number, required: true },
    result: { 
        type: String, 
        required: true, 
        enum: ['VERIFIED', 'REVIEW', 'SUSPICIOUS', 'REJECTED', 'INSUFFICIENT_SAMPLES', 'MULTIPLE_FACES_DETECTED', 'CHALLENGE_FAILED', 'verified', 'review', 'rejected', 'suspicious', 'insufficient_samples'] 
    },
    ipAddress: { type: String },
    deviceFingerprint: { type: String },
    details: { type: mongoose.Schema.Types.Mixed },
    screenshot: { type: String }
}, { timestamps: true });

module.exports = mongoose.models.VerificationLog || mongoose.model('VerificationLog', VerificationLogSchema);
