const mongoose = require('mongoose');

const examSessionSchema = new mongoose.Schema({
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
    startTime: {
        type: Date,
        default: Date.now
    },
    endTime: Date,
    status: {
        type: String,
        enum: ['active', 'completed', 'terminated'],
        default: 'active'
    },
    violationCount: {
        type: Number,
        default: 0
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    
    // Additional fields for compatibility with your server.js
    studentId: { 
        type: String, 
        required: true, 
        index: true 
    },
    studentName: { 
        type: String 
    },
    sessionId: { 
        type: String, 
        required: true, 
        unique: true,
        index: true 
    },
    totalViolations: { 
        type: Number, 
        default: 0 
    },
    tabSwitches: { 
        type: Number, 
        default: 0 
    },
    answers: { 
        type: Map, 
        of: String,
        default: new Map()
    },
    score: { 
        type: Number 
    },
    ipAddress: { 
        type: String 
    },
    userAgent: { 
        type: String 
    },
    deviceInfo: { 
        type: mongoose.Schema.Types.Mixed 
    },
    browserInfo: { 
        type: String 
    },

    // ========== PHONE DETECTION FIELDS ==========
    // Basic phone detection
    isMobile: {
        type: Boolean,
        default: false,
        index: true
    },
    deviceType: {
        type: String,
        enum: ['mobile', 'tablet', 'desktop', 'bot', 'unknown'],
        default: 'unknown',
        index: true
    },
    
    // Detailed device information
    deviceModel: {
        type: String,
        default: ''
    },
    deviceBrand: {
        type: String,
        default: ''
    },
    os: {
        type: String,
        default: ''
    },
    osVersion: {
        type: String,
        default: ''
    },
    
    // Screen and viewport information
    screenResolution: {
        type: String,
        default: ''
    },
    viewportSize: {
        type: String,
        default: ''
    },
    devicePixelRatio: {
        type: Number,
        default: null
    },
    
    // Touch and orientation
    isTouchDevice: {
        type: Boolean,
        default: false
    },
    maxTouchPoints: {
        type: Number,
        default: 0
    },
    orientation: {
        type: String,
        enum: ['portrait', 'landscape', 'unknown'],
        default: 'unknown'
    },
    
    // Mobile-specific features
    isPhone: {
        type: Boolean,
        default: false
    },
    isTablet: {
        type: Boolean,
        default: false
    },
    
    // Battery and network (useful for mobile)
    batteryLevel: {
        type: Number,
        min: 0,
        max: 100,
        default: null
    },
    isCharging: {
        type: Boolean,
        default: null
    },
    connectionType: {
        type: String,
        enum: ['wifi', 'cellular', 'ethernet', 'bluetooth', 'unknown', 'none'],
        default: 'unknown'
    },
    effectiveConnectionType: {
        type: String,
        enum: ['slow-2g', '2g', '3g', '4g', '5g', 'unknown'],
        default: 'unknown'
    },
    
    // Mobile violations tracking
    mobileViolations: {
        type: Number,
        default: 0
    },
    rotationCount: {
        type: Number,
        default: 0
    },
    lastRotationTime: {
        type: Date
    },
    
    // App vs Browser detection
    isNativeApp: {
        type: Boolean,
        default: false
    },
    isWebView: {
        type: Boolean,
        default: false
    },
    
    // Phone number detection (if applicable)
    phoneNumber: {
        type: String,
        sparse: true,
        index: true
    },
    phoneVerified: {
        type: Boolean,
        default: false
    },
    
    // Complete device fingerprint
    deviceFingerprint: {
        type: String,
        index: true
    },
    
    // Additional mobile metadata
    mobileMetadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, {
    timestamps: true // Adds createdAt and updatedAt
});

// Create indexes for better query performance
examSessionSchema.index({ userId: 1, examId: 1, startTime: -1 });
examSessionSchema.index({ studentId: 1, examId: 1, startTime: -1 });
examSessionSchema.index({ sessionId: 1 });
examSessionSchema.index({ status: 1 });
examSessionSchema.index({ deviceType: 1, isMobile: 1 });
examSessionSchema.index({ isPhone: 1, isTablet: 1 });
examSessionSchema.index({ deviceFingerprint: 1 });

// Virtual for session duration
examSessionSchema.virtual('duration').get(function() {
    if (this.endTime) {
        return (this.endTime - this.startTime) / 1000 / 60; // minutes
    }
    return null;
});

// Virtual for formatted start time
examSessionSchema.virtual('formattedStartTime').get(function() {
    return this.startTime.toLocaleString();
});

// Virtual to check if device is mobile
examSessionSchema.virtual('isMobileDevice').get(function() {
    return this.isMobile === true;
});

// Virtual to check if device is desktop
examSessionSchema.virtual('isDesktopDevice').get(function() {
    return this.deviceType === 'desktop';
});

// Method to detect and set device information from user agent and client data
examSessionSchema.methods.detectDevice = async function(clientInfo = {}) {
    const userAgent = this.userAgent || clientInfo.userAgent || '';
    const screenData = clientInfo.screen || {};
    const touchData = clientInfo.touchPoints || 0;
    const orientationData = clientInfo.orientation || 'unknown';
    const batteryData = clientInfo.battery || {};
    const networkData = clientInfo.network || {};
    
    // Parse user agent for device detection
    const deviceInfo = parseUserAgent(userAgent);
    
    // Set basic device detection
    this.isMobile = deviceInfo.isMobile;
    this.deviceType = deviceInfo.deviceType;
    this.deviceModel = deviceInfo.model;
    this.deviceBrand = deviceInfo.brand;
    this.os = deviceInfo.os;
    this.osVersion = deviceInfo.osVersion;
    this.isPhone = deviceInfo.isPhone;
    this.isTablet = deviceInfo.isTablet;
    
    // Set screen information
    if (screenData.width && screenData.height) {
        this.screenResolution = `${screenData.width}x${screenData.height}`;
    }
    if (screenData.viewportWidth && screenData.viewportHeight) {
        this.viewportSize = `${screenData.viewportWidth}x${screenData.viewportHeight}`;
    }
    if (screenData.devicePixelRatio) {
        this.devicePixelRatio = screenData.devicePixelRatio;
    }
    
    // Set touch information
    this.isTouchDevice = touchData > 0 || deviceInfo.isTouchDevice;
    this.maxTouchPoints = touchData;
    
    // Set orientation
    this.orientation = orientationData;
    
    // Set battery information
    if (batteryData.level !== undefined) {
        this.batteryLevel = batteryData.level;
        this.isCharging = batteryData.charging;
    }
    
    // Set network information
    if (networkData.type) {
        this.connectionType = networkData.type;
    }
    if (networkData.effectiveType) {
        this.effectiveConnectionType = networkData.effectiveType;
    }
    
    // Detect if it's a native app or webview
    this.isNativeApp = detectNativeApp(userAgent);
    this.isWebView = detectWebView(userAgent);
    
    // Generate device fingerprint
    this.deviceFingerprint = await generateDeviceFingerprint(this, clientInfo);
    
    // Store additional metadata
    this.mobileMetadata = {
        ...this.mobileMetadata,
        detectedAt: new Date(),
        clientInfo: clientInfo,
        rawUserAgent: userAgent,
        screenDetails: screenData,
        touchCapabilities: touchData,
        orientation: orientationData,
        battery: batteryData,
        network: networkData
    };
    
    await this.save();
    return this.getDeviceSummary();
};

// Method to add mobile-specific violation
examSessionSchema.methods.addMobileViolation = async function(violationType, details = {}) {
    this.mobileViolations = (this.mobileViolations || 0) + 1;
    this.violationCount += 1;
    this.totalViolations = this.violationCount;
    
    // Store violation details in metadata
    if (!this.metadata.mobileViolations) {
        this.metadata.mobileViolations = [];
    }
    
    this.metadata.mobileViolations.push({
        type: violationType,
        timestamp: new Date(),
        details: details,
        orientation: this.orientation,
        batteryLevel: this.batteryLevel,
        connectionType: this.connectionType
    });
    
    await this.save();
    return this.mobileViolations;
};

// Method to track device rotation
examSessionSchema.methods.trackRotation = async function(newOrientation) {
    if (this.orientation !== newOrientation) {
        this.rotationCount = (this.rotationCount || 0) + 1;
        this.lastRotationTime = new Date();
        this.orientation = newOrientation;
        
        // Log rotation as potential violation if during exam
        if (this.status === 'active') {
            await this.addMobileViolation('device_rotation', {
                from: this.orientation,
                to: newOrientation,
                timestamp: new Date()
            });
        }
        
        await this.save();
    }
    return this.rotationCount;
};

// Method to get device summary
examSessionSchema.methods.getDeviceSummary = function() {
    return {
        sessionId: this.sessionId,
        isMobile: this.isMobile,
        deviceType: this.deviceType,
        isPhone: this.isPhone,
        isTablet: this.isTablet,
        deviceModel: this.deviceModel,
        deviceBrand: this.deviceBrand,
        os: `${this.os} ${this.osVersion}`.trim(),
        screenResolution: this.screenResolution,
        orientation: this.orientation,
        isTouchDevice: this.isTouchDevice,
        maxTouchPoints: this.maxTouchPoints,
        batteryLevel: this.batteryLevel,
        isCharging: this.isCharging,
        connectionType: this.connectionType,
        isNativeApp: this.isNativeApp,
        isWebView: this.isWebView,
        deviceFingerprint: this.deviceFingerprint
    };
};

// Method to check if mobile device is allowed for exam
examSessionSchema.methods.isMobileAllowed = function(allowedDevices = ['desktop', 'tablet']) {
    if (allowedDevices.includes(this.deviceType)) {
        return true;
    }
    
    if (this.isPhone && !allowedDevices.includes('mobile')) {
        return false;
    }
    
    return allowedDevices.includes(this.deviceType);
};

// Method to get mobile violations summary
examSessionSchema.methods.getMobileViolationsSummary = function() {
    return {
        totalMobileViolations: this.mobileViolations,
        rotationCount: this.rotationCount,
        lastRotationTime: this.lastRotationTime,
        violations: this.metadata.mobileViolations || [],
        recentViolations: (this.metadata.mobileViolations || []).slice(-5)
    };
};

// Method to update network status (useful for mobile)
examSessionSchema.methods.updateNetworkStatus = async function(networkInfo) {
    if (networkInfo.type) {
        this.connectionType = networkInfo.type;
    }
    if (networkInfo.effectiveType) {
        this.effectiveConnectionType = networkInfo.effectiveType;
    }
    
    this.mobileMetadata = {
        ...this.mobileMetadata,
        networkUpdates: [
            ...(this.mobileMetadata.networkUpdates || []),
            {
                timestamp: new Date(),
                ...networkInfo
            }
        ].slice(-10) // Keep last 10 updates
    };
    
    await this.save();
    return {
        connectionType: this.connectionType,
        effectiveConnectionType: this.effectiveConnectionType
    };
};

// Method to update battery status (useful for mobile)
examSessionSchema.methods.updateBatteryStatus = async function(batteryInfo) {
    if (batteryInfo.level !== undefined) {
        this.batteryLevel = batteryInfo.level;
    }
    if (batteryInfo.charging !== undefined) {
        this.isCharging = batteryInfo.charging;
    }
    
    this.mobileMetadata = {
        ...this.mobileMetadata,
        batteryUpdates: [
            ...(this.mobileMetadata.batteryUpdates || []),
            {
                timestamp: new Date(),
                ...batteryInfo
            }
        ].slice(-10) // Keep last 10 updates
    };
    
    await this.save();
    return {
        batteryLevel: this.batteryLevel,
        isCharging: this.isCharging
    };
};

// Virtual for formatted start time
examSessionSchema.virtual('formattedStartTime').get(function() {
    return this.startTime.toLocaleString();
});

// Method to check if exam is active
examSessionSchema.methods.isActive = function() {
    return this.status === 'active';
};

// Method to check if exam is completed
examSessionSchema.methods.isCompleted = function() {
    return this.status === 'completed';
};

// Method to check if exam is terminated
examSessionSchema.methods.isTerminated = function() {
    return this.status === 'terminated';
};

// Method to add a violation
examSessionSchema.methods.addViolation = async function() {
    this.violationCount += 1;
    this.totalViolations = this.violationCount;
    await this.save();
    return this.violationCount;
};

// Method to add a tab switch
examSessionSchema.methods.addTabSwitch = async function() {
    this.tabSwitches = (this.tabSwitches || 0) + 1;
    this.violationCount += 1;
    this.totalViolations = this.violationCount;
    await this.save();
    return this.tabSwitches;
};

// Method to terminate exam
examSessionSchema.methods.terminate = async function(reason) {
    this.status = 'terminated';
    this.endTime = new Date();
    this.metadata = {
        ...this.metadata,
        terminationReason: reason,
        terminatedAt: new Date(),
        finalDeviceInfo: this.getDeviceSummary(),
        finalMobileViolations: this.getMobileViolationsSummary()
    };
    await this.save();
    return true;
};

// Method to complete exam
examSessionSchema.methods.complete = async function(answers, score) {
    this.status = 'completed';
    this.endTime = new Date();
    this.answers = answers || new Map();
    this.score = score;
    this.metadata = {
        ...this.metadata,
        completedAt: new Date(),
        finalScore: score,
        totalViolations: this.violationCount,
        tabSwitches: this.tabSwitches,
        mobileViolations: this.mobileViolations,
        finalDeviceInfo: this.getDeviceSummary()
    };
    await this.save();
    return true;
};

// Method to get session summary
examSessionSchema.methods.getSummary = function() {
    return {
        sessionId: this.sessionId,
        studentId: this.studentId || this.userId,
        studentName: this.studentName,
        examId: this.examId,
        startTime: this.startTime,
        endTime: this.endTime,
        duration: this.duration,
        status: this.status,
        totalViolations: this.totalViolations || this.violationCount,
        tabSwitches: this.tabSwitches,
        score: this.score,
        deviceInfo: this.getDeviceSummary(),
        mobileViolations: this.mobileViolations
    };
};

// Static method to get active sessions
examSessionSchema.statics.getActiveSessions = async function() {
    return await this.find({ status: 'active' })
        .sort({ startTime: -1 })
        .populate('userId', 'name email');
};

// Static method to get sessions by student
examSessionSchema.statics.getSessionsByStudent = async function(studentId, limit = 10) {
    return await this.find({ 
        $or: [
            { studentId: studentId },
            { userId: studentId }
        ]
    })
    .sort({ startTime: -1 })
    .limit(limit);
};

// Static method to get sessions by exam
examSessionSchema.statics.getSessionsByExam = async function(examId, limit = 50) {
    return await this.find({ examId })
        .sort({ startTime: -1 })
        .limit(limit);
};

// Static method to get session statistics
examSessionSchema.statics.getSessionStats = async function(studentId) {
    const stats = await this.aggregate([
        { 
            $match: { 
                $or: [
                    { studentId: studentId },
                    { userId: studentId }
                ]
            } 
        },
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 },
                avgScore: { $avg: '$score' },
                avgViolations: { $avg: '$violationCount' },
                avgMobileViolations: { $avg: '$mobileViolations' }
            }
        }
    ]);
    return stats;
};

// Static method to get mobile device statistics
examSessionSchema.statics.getMobileStats = async function() {
    const stats = await this.aggregate([
        {
            $group: {
                _id: '$deviceType',
                count: { $sum: 1 },
                avgViolations: { $avg: '$violationCount' },
                avgMobileViolations: { $avg: '$mobileViolations' },
                avgScore: { $avg: '$score' }
            }
        }
    ]);
    return stats;
};

// Static method to get sessions by device type
examSessionSchema.statics.getSessionsByDeviceType = async function(deviceType, limit = 50) {
    return await this.find({ deviceType })
        .sort({ startTime: -1 })
        .limit(limit);
};

// Static method to get sessions by phone number
examSessionSchema.statics.getSessionsByPhoneNumber = async function(phoneNumber) {
    return await this.find({ phoneNumber })
        .sort({ startTime: -1 });
};

// Pre-save middleware to populate additional fields
examSessionSchema.pre('save', function(next) {
    // If studentId is not set but userId is, set studentId from userId
    if (!this.studentId && this.userId) {
        this.studentId = this.userId.toString();
    }
    
    // Ensure totalViolations matches violationCount
    if (this.totalViolations !== this.violationCount) {
        this.totalViolations = this.violationCount;
    }
    
    // Auto-detect device if not already detected
    if (this.isModified('userAgent') && !this.deviceFingerprint) {
        // This will trigger device detection on save if not already done
        this.metadata.deviceDetectionPending = true;
    }
    
    // Add metadata tracking
    if (!this.metadata.createdAt) {
        this.metadata = {
            ...this.metadata,
            createdAt: new Date(),
            userAgent: this.userAgent,
            ipAddress: this.ipAddress,
            deviceInfoAtStart: this.getDeviceSummary ? this.getDeviceSummary() : null
        };
    }
    
    next();
});

// Post-save middleware for logging
examSessionSchema.post('save', function(doc) {
    const deviceType = doc.deviceType || 'unknown';
    const isMobile = doc.isMobile ? '📱' : '💻';
    console.log(`📝 Exam session ${doc.sessionId} saved with status: ${doc.status} | Device: ${deviceType} ${isMobile}`);
});

// Helper functions for device detection
function parseUserAgent(userAgent) {
    const ua = userAgent.toLowerCase();
    const deviceInfo = {
        isMobile: false,
        deviceType: 'unknown',
        model: '',
        brand: '',
        os: '',
        osVersion: '',
        isPhone: false,
        isTablet: false,
        isTouchDevice: false
    };
    
    // Detect mobile devices
    const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|windows phone|opera mini|iemobile|mobile/i;
    deviceInfo.isMobile = mobileRegex.test(ua);
    
    // Detect tablet
    const tabletRegex = /ipad|android(?!.*mobile)|tablet|kindle|silk/i;
    deviceInfo.isTablet = tabletRegex.test(ua);
    deviceInfo.isPhone = deviceInfo.isMobile && !deviceInfo.isTablet;
    
    // Set device type
    if (deviceInfo.isTablet) {
        deviceInfo.deviceType = 'tablet';
    } else if (deviceInfo.isMobile) {
        deviceInfo.deviceType = 'mobile';
    } else {
        deviceInfo.deviceType = 'desktop';
    }
    
    // Detect brand and model
    if (ua.includes('iphone')) {
        deviceInfo.brand = 'Apple';
        const match = ua.match(/iphone os (\d+[._]\d+)/);
        if (match) deviceInfo.model = `iPhone (iOS ${match[1].replace('_', '.')})`;
    } else if (ua.includes('ipad')) {
        deviceInfo.brand = 'Apple';
        deviceInfo.model = 'iPad';
    } else if (ua.includes('samsung')) {
        deviceInfo.brand = 'Samsung';
    } else if (ua.includes('xiaomi')) {
        deviceInfo.brand = 'Xiaomi';
    } else if (ua.includes('oneplus')) {
        deviceInfo.brand = 'OnePlus';
    } else if (ua.includes('google') || ua.includes('pixel')) {
        deviceInfo.brand = 'Google';
    }
    
    // Detect OS
    if (ua.includes('windows')) {
        deviceInfo.os = 'Windows';
        const match = ua.match(/windows nt (\d+\.\d+)/);
        if (match) deviceInfo.osVersion = match[1];
    } else if (ua.includes('mac os')) {
        deviceInfo.os = 'macOS';
        const match = ua.match(/mac os x (\d+[._]\d+)/);
        if (match) deviceInfo.osVersion = match[1].replace('_', '.');
    } else if (ua.includes('android')) {
        deviceInfo.os = 'Android';
        const match = ua.match(/android (\d+\.\d+)/);
        if (match) deviceInfo.osVersion = match[1];
    } else if (ua.includes('ios') || ua.includes('iphone') || ua.includes('ipad')) {
        deviceInfo.os = 'iOS';
        const match = ua.match(/os (\d+[._]\d+)/);
        if (match) deviceInfo.osVersion = match[1].replace('_', '.');
    } else if (ua.includes('linux')) {
        deviceInfo.os = 'Linux';
    }
    
    // Most modern devices are touch capable
    deviceInfo.isTouchDevice = deviceInfo.isMobile || ua.includes('touch');
    
    return deviceInfo;
}

function detectNativeApp(userAgent) {
    const ua = userAgent.toLowerCase();
    // Check for common app identifiers
    return ua.includes('fbav') || // Facebook App
           ua.includes('fban') || // Facebook App
           ua.includes('instagram') ||
           ua.includes('twitter') ||
           ua.includes('snapchat') ||
           ua.includes('linkedin') ||
           ua.includes('whatsapp') ||
           ua.includes('messenger');
}

function detectWebView(userAgent) {
    const ua = userAgent.toLowerCase();
    // WebView detection
    return (ua.includes('wv') && ua.includes('android')) || // Android WebView
           (ua.includes('safari') && !ua.includes('version/') && ua.includes('iphone')) || // iOS WebView
           ua.includes('webview');
}

async function generateDeviceFingerprint(session, clientInfo) {
    const components = [
        session.userAgent,
        session.screenResolution,
        session.devicePixelRatio,
        session.maxTouchPoints,
        session.os,
        session.deviceBrand,
        session.deviceModel,
        clientInfo.language,
        clientInfo.timezone,
        clientInfo.platform
    ];
    
    const fingerprintString = components.filter(c => c).join('|');
    
    // Simple hash function (you might want to use crypto for production)
    let hash = 0;
    for (let i = 0; i < fingerprintString.length; i++) {
        const char = fingerprintString.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash).toString(16);
}

module.exports = mongoose.model('ExamSession', examSessionSchema);