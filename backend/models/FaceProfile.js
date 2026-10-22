const mongoose = require('mongoose');

const FaceProfileSchema = new mongoose.Schema({
    studentId: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    enrollmentImages: [{ type: String }],
    embeddings: [[Number]], // Array of 30 L2-normalized 512d InsightFace embeddings
    averageEmbedding: [Number], // 512d mean normalized embedding
    descriptors: [[Number]], // Array of 30 128d FaceAPI neural descriptors
    averageDescriptor: [Number], // 128d mean normalized descriptor
    enrollmentDate: { type: Date, default: Date.now },
    modelVersion: { type: String, default: 'InsightFace-ArcFace' }
}, { timestamps: true });

module.exports = mongoose.models.FaceProfile || mongoose.model('FaceProfile', FaceProfileSchema);
