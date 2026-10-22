const mongoose = require('mongoose');

const proctoringLogSchema = new mongoose.Schema(
{
    // Original fields (keeping your structure)
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
    type: {
        type: String,
        enum: ['info', 'warning', 'violation', 'error'],
        required: true
    },
    message: {
        type: String,
        required: true,
        trim: true
    },
    eventType: {
        type: String,
        enum: [
            'TAB_SWITCH',
            'MULTIPLE_FACE',
            'PHONE_DETECTED',
            'NO_FACE',
            'AUDIO_DETECTED',
            'WINDOW_BLUR',
            'COPY_PASTE',
            'LOOKING_AWAY',
            'FULLSCREEN_EXIT',
            'EXAM_TERMINATED',
            'EXAM_SUBMITTED',
            'DEVICE_CHANGED',
            'MOBILE_DEVICE_DETECTED',
            'TABLET_DEVICE_DETECTED',
            'DEVICE_VIOLATION',
            'EXAM_ATTEMPT_BLOCKED',
            'OTHER'
        ],
        default: 'OTHER'
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    
    // Additional fields for compatibility with your server.js
    studentId: { 
        type: String, 
        index: true 
    },
    sessionId: { 
        type: String,
        index: true 
    },
    violationType: { 
        type: String,
        enum: ['tab_switch', 'multiple_faces', 'no_face', 'phone_detected', 'tablet_detected', 'device_changed', 'voice_detected', 'looking_away', 'fullscreen_exit', 'exam_terminated', 'exam_submitted', 'info', 'device_violation'],
        index: true
    },
    severity: { 
        type: String, 
        enum: ['low', 'medium', 'high'], 
        default: 'medium' 
    },
    screenshot: { 
        type: String 
    },
    ipAddress: { 
        type: String 
    },
    userAgent: { 
        type: String 
    },
    timestamp: { 
        type: Date, 
        default: Date.now 
    },
    
    // ===== ADDED PHONE DETECTION FIELDS =====
    deviceInfo: {
        deviceType: { 
            type: String, 
            enum: ['phone', 'tablet', 'desktop', 'unknown'],
            default: 'unknown'
        },
        isPhone: { 
            type: Boolean, 
            default: false 
        },
        isTablet: { 
            type: Boolean, 
            default: false 
        },
        screenWidth: { 
            type: Number 
        },
        screenHeight: { 
            type: Number 
        },
        screenResolution: { 
            type: String 
        },
        browserInfo: { 
            type: String 
        },
        osInfo: { 
            type: String 
        }
    },
    deviceChangeDetected: {
        type: Boolean,
        default: false
    },
    previousDeviceType: {
        type: String,
        enum: ['phone', 'tablet', 'desktop', 'unknown']
    },
    examAttemptBlocked: {
        type: Boolean,
        default: false
    },
    blockReason: {
        type: String
    }
},
{
    timestamps: true
});

// Create indexes for better query performance
proctoringLogSchema.index({ userId: 1, examId: 1, createdAt: -1 });
proctoringLogSchema.index({ studentId: 1, examId: 1, timestamp: -1 });
proctoringLogSchema.index({ sessionId: 1 });
proctoringLogSchema.index({ violationType: 1 });
proctoringLogSchema.index({ severity: 1 });
proctoringLogSchema.index({ 'deviceInfo.deviceType': 1 });
proctoringLogSchema.index({ 'deviceInfo.isPhone': 1 });
proctoringLogSchema.index({ examAttemptBlocked: 1 });

// Virtual for formatted timestamp
proctoringLogSchema.virtual('formattedTimestamp').get(function() {
    return this.timestamp ? this.timestamp.toLocaleString() : this.createdAt.toLocaleString();
});

// Method to convert eventType to violationType
proctoringLogSchema.methods.getViolationType = function() {
    const mapping = {
        'TAB_SWITCH': 'tab_switch',
        'MULTIPLE_FACE': 'multiple_faces',
        'PHONE_DETECTED': 'phone_detected',
        'TABLET_DEVICE_DETECTED': 'tablet_detected',
        'MOBILE_DEVICE_DETECTED': 'phone_detected',
        'DEVICE_CHANGED': 'device_changed',
        'DEVICE_VIOLATION': 'device_violation',
        'EXAM_ATTEMPT_BLOCKED': 'device_violation',
        'NO_FACE': 'no_face',
        'AUDIO_DETECTED': 'voice_detected',
        'LOOKING_AWAY': 'looking_away',
        'FULLSCREEN_EXIT': 'fullscreen_exit',
        'EXAM_TERMINATED': 'exam_terminated',
        'EXAM_SUBMITTED': 'exam_submitted'
    };
    return mapping[this.eventType] || 'info';
};

// Method to get severity from event type
proctoringLogSchema.methods.getSeverity = function() {
    const highSeverity = ['MULTIPLE_FACE', 'PHONE_DETECTED', 'MOBILE_DEVICE_DETECTED', 'EXAM_ATTEMPT_BLOCKED', 'DEVICE_VIOLATION', 'EXAM_TERMINATED'];
    const mediumSeverity = ['TAB_SWITCH', 'DEVICE_CHANGED', 'TABLET_DEVICE_DETECTED', 'AUDIO_DETECTED', 'LOOKING_AWAY', 'FULLSCREEN_EXIT'];
    
    if (highSeverity.includes(this.eventType)) return 'high';
    if (mediumSeverity.includes(this.eventType)) return 'medium';
    return 'low';
};

// Static method to get violations by student
proctoringLogSchema.statics.getViolationsByStudent = async function(studentId, limit = 50) {
    return await this.find({ 
        $or: [
            { studentId: studentId },
            { userId: studentId }
        ]
    }).sort({ timestamp: -1, createdAt: -1 }).limit(limit);
};

// Static method to get violations by exam
proctoringLogSchema.statics.getViolationsByExam = async function(examId, limit = 100) {
    return await this.find({ examId })
        .sort({ timestamp: -1, createdAt: -1 })
        .limit(limit);
};

// Static method to get violation statistics
proctoringLogSchema.statics.getViolationStats = async function(studentId) {
    const stats = await this.aggregate([
        { 
            $match: { 
                $or: [
                    { studentId: studentId },
                    { userId: studentId }
                ],
                type: 'violation'
            } 
        },
        { 
            $group: {
                _id: '$eventType',
                count: { $sum: 1 }
            }
        },
        { $sort: { count: -1 } }
    ]);
    return stats;
};

// ===== NEW: Get device violation statistics =====
proctoringLogSchema.statics.getDeviceViolationStats = async function(studentId) {
    const stats = await this.aggregate([
        { 
            $match: { 
                $or: [
                    { studentId: studentId },
                    { userId: studentId }
                ],
                $or: [
                    { eventType: 'PHONE_DETECTED' },
                    { eventType: 'MOBILE_DEVICE_DETECTED' },
                    { eventType: 'DEVICE_CHANGED' },
                    { eventType: 'DEVICE_VIOLATION' },
                    { eventType: 'EXAM_ATTEMPT_BLOCKED' },
                    { 'deviceInfo.isPhone': true }
                ]
            } 
        },
        { 
            $group: {
                _id: '$eventType',
                count: { $sum: 1 },
                devices: { $addToSet: '$deviceInfo.deviceType' }
            }
        },
        { $sort: { count: -1 } }
    ]);
    return stats;
};

// ===== NEW: Get mobile exam attempts =====
proctoringLogSchema.statics.getMobileExamAttempts = async function(examId) {
    const attempts = await this.find({
        examId: examId,
        $or: [
            { eventType: 'EXAM_ATTEMPT_BLOCKED' },
            { eventType: 'MOBILE_DEVICE_DETECTED' },
            { 'deviceInfo.isPhone': true }
        ]
    }).sort({ timestamp: -1 });
    
    return attempts;
};

// ===== NEW: Log phone detection during exam =====
proctoringLogSchema.statics.logPhoneDetection = async function(userId, examId, deviceInfo, sessionId = null) {
    const log = new this({
        userId: userId,
        examId: examId,
        studentId: userId.toString(),
        sessionId: sessionId,
        type: 'violation',
        eventType: 'PHONE_DETECTED',
        violationType: 'phone_detected',
        severity: 'high',
        message: `Mobile device (${deviceInfo.deviceType}) detected during exam. Device: ${deviceInfo.browserInfo || 'Unknown browser'}`,
        deviceInfo: deviceInfo,
        deviceChangeDetected: false,
        ipAddress: deviceInfo.ipAddress,
        userAgent: deviceInfo.userAgent,
        timestamp: new Date(),
        metadata: {
            detectedAt: new Date().toISOString(),
            screenResolution: deviceInfo.screenResolution,
            browserInfo: deviceInfo.browserInfo
        }
    });
    
    return await log.save();
};

// ===== NEW: Log device change during exam =====
proctoringLogSchema.statics.logDeviceChange = async function(userId, examId, previousDevice, currentDevice, sessionId = null) {
    const log = new this({
        userId: userId,
        examId: examId,
        studentId: userId.toString(),
        sessionId: sessionId,
        type: 'violation',
        eventType: 'DEVICE_CHANGED',
        violationType: 'device_changed',
        severity: 'medium',
        message: `Device changed from ${previousDevice.deviceType} to ${currentDevice.deviceType} during exam`,
        deviceInfo: currentDevice,
        deviceChangeDetected: true,
        previousDeviceType: previousDevice.deviceType,
        ipAddress: currentDevice.ipAddress,
        userAgent: currentDevice.userAgent,
        timestamp: new Date(),
        metadata: {
            previousDevice: previousDevice,
            currentDevice: currentDevice,
            changedAt: new Date().toISOString()
        }
    });
    
    return await log.save();
};

// ===== NEW: Log blocked exam attempt =====
proctoringLogSchema.statics.logBlockedExamAttempt = async function(userId, examId, deviceInfo, reason, sessionId = null) {
    const log = new this({
        userId: userId,
        examId: examId,
        studentId: userId.toString(),
        sessionId: sessionId,
        type: 'violation',
        eventType: 'EXAM_ATTEMPT_BLOCKED',
        violationType: 'device_violation',
        severity: 'high',
        message: `Exam attempt blocked: ${reason}. Device: ${deviceInfo.deviceType}`,
        deviceInfo: deviceInfo,
        examAttemptBlocked: true,
        blockReason: reason,
        ipAddress: deviceInfo.ipAddress,
        userAgent: deviceInfo.userAgent,
        timestamp: new Date(),
        metadata: {
            blockedAt: new Date().toISOString(),
            reason: reason,
            deviceInfo: deviceInfo
        }
    });
    
    return await log.save();
};

// Pre-save middleware to populate additional fields
proctoringLogSchema.pre('save', function(next) {
    // If studentId is not set but userId is, try to set studentId from userId
    if (!this.studentId && this.userId) {
        this.studentId = this.userId.toString();
    }
    
    // Set violationType based on eventType
    if (!this.violationType && this.eventType) {
        this.violationType = this.getViolationType();
    }
    
    // Set severity if not set
    if (!this.severity && this.eventType) {
        this.severity = this.getSeverity();
    }
    
    // Auto-set message if not provided and it's a phone detection
    if (!this.message && this.eventType === 'PHONE_DETECTED') {
        this.message = `Mobile device detected during exam. Device type: ${this.deviceInfo?.deviceType || 'unknown'}`;
    }
    
    next();
});

module.exports = mongoose.model('ProctoringLog', proctoringLogSchema);