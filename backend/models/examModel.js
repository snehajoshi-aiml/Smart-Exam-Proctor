const mongoose = require('mongoose');

// Your existing exam schema
const examSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    description: String,
    duration: {
        type: Number,
        required: true
    },
    totalMarks: Number,
    passingMarks: Number,
    questions: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Question'
    }],
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    startTime: Date,
    endTime: Date,
    isActive: {
        type: Boolean,
        default: true
    },
    proctoringEnabled: {
        type: Boolean,
        default: true
    },
    maxTabSwitches: {
        type: Number,
        default: 3
    }
}, {
    timestamps: true
});

// Add ExamSession schema for proctoring
const examSessionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    examId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Exam',
        required: true
    },
    startTime: {
        type: Date,
        default: Date.now,
        required: true
    },
    endTime: Date,
    status: {
        type: String,
        enum: ['active', 'completed', 'terminated', 'suspended'],
        default: 'active'
    },
    terminationReason: String,
    terminatedAt: Date,
    tabSwitchCount: {
        type: Number,
        default: 0
    },
    proctoringEnabled: {
        type: Boolean,
        default: true
    },
    lastActivity: {
        type: Date,
        default: Date.now
    },
    ipAddress: String,
    userAgent: String,
    warnings: [{
        type: String,
        timestamp: Date
    }]
}, {
    timestamps: true
});

// Create models
const Exam = mongoose.model('Exam', examSchema);
const ExamSession = mongoose.model('ExamSession', examSessionSchema);

module.exports = {
    Exam,
    ExamSession
};