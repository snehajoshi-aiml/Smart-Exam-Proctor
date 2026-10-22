// backend/controllers/proctoringController.js
const { getDeviceValidator } = require('../middleware/deviceValidator');
const CheatingLog = require('../models/cheatingLogModel');
const ExamSession = require('../models/ExamSession');

/**
 * Start proctoring with device validation
 */
exports.startProctoring = async (req, res) => {
    try {
        const { examId, userId } = req.body;
        
        // Get device validator instance
        const validator = getDeviceValidator();
        
        // Validate device first
        const validationResult = validator.validateDevice(req);
        
        if (!validationResult.valid) {
            return res.status(400).json({
                success: false,
                message: validationResult.reason,
                deviceInfo: validationResult.deviceInfo
            });
        }

        // Start proctoring
        const proctoringResult = validator.startProctoring(examId, userId);
        
        // Create exam session
        const session = new ExamSession({
            examId,
            userId,
            startTime: new Date(),
            status: 'active',
            deviceInfo: validationResult.deviceInfo,
            proctoring: {
                active: true,
                startedAt: new Date(),
                detectionActive: true
            }
        });
        
        await session.save();
        
        res.json({
            success: true,
            sessionId: session._id,
            deviceValidation: validationResult,
            proctoring: proctoringResult,
            message: 'Proctoring started with device validation'
        });
        
    } catch (error) {
        console.error('Proctoring start error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Get current detection status with device info
 */
exports.getDetectionStatus = async (req, res) => {
    try {
        const { sessionId } = req.params;
        
        const validator = getDeviceValidator();
        const status = validator.getDetectionStatus();
        
        // Get session info
        const session = await ExamSession.findById(sessionId);
        
        res.json({
            success: true,
            sessionId: sessionId,
            deviceInfo: session?.deviceInfo || {},
            detectionStatus: status,
            isActive: validator.isDetectionActive
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Get suspicious activities with device context
 */
exports.getSuspiciousActivities = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { limit = 50 } = req.query;
        
        const validator = getDeviceValidator();
        
        // Get activities from memory
        const memoryActivities = validator.getSuspiciousActivities();
        
        // Get activities from database
        const dbActivities = await CheatingLog.find({
            examId: sessionId
        })
        .sort({ timestamp: -1 })
        .limit(parseInt(limit));
        
        res.json({
            success: true,
            sessionId: sessionId,
            memoryActivities: memoryActivities.slice(-parseInt(limit)),
            databaseActivities: dbActivities,
            totalMemory: memoryActivities.length,
            totalDatabase: await CheatingLog.countDocuments({ examId: sessionId })
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Log suspicious activity with device validation
 */
exports.logSuspiciousActivity = async (req, res) => {
    try {
        const { examId, userId, type, severity, details } = req.body;
        
        const validator = getDeviceValidator();
        
        const log = await validator.logSuspiciousActivity(req, {
            examId,
            userId,
            type,
            severity,
            details
        });
        
        res.json({
            success: true,
            log: log,
            deviceInfo: validator.deviceInfo,
            message: 'Suspicious activity logged'
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Stop proctoring
 */
exports.stopProctoring = async (req, res) => {
    try {
        const { sessionId } = req.body;
        
        const validator = getDeviceValidator();
        const stopResult = validator.stopProctoring();
        
        await ExamSession.findByIdAndUpdate(sessionId, {
            status: 'completed',
            endTime: new Date(),
            proctoring: {
                active: false,
                endedAt: new Date()
            }
        });
        
        res.json({
            success: true,
            sessionId: sessionId,
            stopResult: stopResult,
            message: 'Proctoring stopped'
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Validate device only (without starting proctoring)
 */
exports.validateDevice = async (req, res) => {
    try {
        const validator = getDeviceValidator();
        const validationResult = validator.validateDevice(req);
        
        res.json({
            success: true,
            validation: validationResult,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

/**
 * Get device information
 */
exports.getDeviceInfo = async (req, res) => {
    try {
        const validator = getDeviceValidator();
        const info = validator.init(req);
        
        res.json({
            success: true,
            deviceInfo: info,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};