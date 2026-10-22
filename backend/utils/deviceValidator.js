// backend/middleware/deviceValidator.js
const PhoneDetection = require('../utils/phoneDetection');
const CheatingLog = require('../models/cheatingLogModel');

// Initialize phone detection globally
let phoneDetector = null;

class DeviceValidator {
    constructor() {
        this.deviceInfo = {
            userAgent: null,
            platform: null,
            screenResolution: null,
            deviceType: null,
            isMobile: false,
            isTablet: false,
            isDesktop: false,
            ipAddress: null,
            timestamp: null
        };
        this.secondaryDevices = [];
        this.suspiciousActivities = [];
        this.phoneDetector = null;
        this.isDetectionActive = false;
        this.proctoringSessionId = null;
        this.examId = null;
        this.userId = null;
        this.detectionStartTime = null;
        this.totalViolations = 0;
        this.headDownEvents = 0;
        this.phoneDetectionEvents = 0;
        this.earphonesDetectionEvents = 0;
        this.booksDetectionEvents = 0;
        
        // ===== NEW: Head Direction Tracking =====
        this.headDirections = {
            current: 'center',
            previous: 'center',
            leftCount: 0,
            rightCount: 0,
            upCount: 0,
            downCount: 0,
            centerCount: 0,
            suspiciousDirectionChanges: 0,
            lastDirectionChange: null,
            directionHistory: []
        };
        
        // ===== NEW: Head Movement Thresholds =====
        this.thresholds = {
            LOOKING_UP: -15,      // degrees
            LOOKING_DOWN: 20,     // degrees
            LOOKING_LEFT: -20,    // degrees
            LOOKING_RIGHT: 20,    // degrees
            MAX_HISTORY: 20,
            DIRECTION_CHANGE_THRESHOLD: 3 // changes per minute before flagging
        };
    }

    /**
     * Initialize device validation
     */
    init(req) {
        const userAgent = req.headers['user-agent'] || '';
        this.deviceInfo = {
            userAgent: userAgent,
            platform: req.headers['sec-ch-ua-platform'] || 'Unknown',
            screenResolution: req.headers['viewport'] || req.headers['sec-ch-ua-viewport'] || 'Unknown',
            deviceType: this.detectDeviceType(userAgent),
            isMobile: this.isMobileDevice(userAgent),
            isTablet: this.isTabletDevice(userAgent),
            isDesktop: !this.isMobileDevice(userAgent) && !this.isTabletDevice(userAgent),
            ipAddress: req.ip || req.connection?.remoteAddress || 'unknown',
            timestamp: new Date().toISOString(),
            userAgent: userAgent,
            referer: req.headers.referer || 'unknown'
        };

        // Initialize phone detection if not already
        if (!phoneDetector) {
            phoneDetector = new PhoneDetection();
            phoneDetector.init(this.deviceInfo, {
                type: 'secondary_device',
                status: 'monitoring'
            });
            this.phoneDetector = phoneDetector;
            this.isDetectionActive = true;
        } else {
            this.phoneDetector = phoneDetector;
        }

        console.log('📱 Device validated:', this.deviceInfo.deviceType, this.deviceInfo.ipAddress);
        return this.deviceInfo;
    }

    /**
     * Detect device type from user agent
     */
    detectDeviceType(userAgent) {
        if (this.isMobileDevice(userAgent)) return 'Mobile';
        if (this.isTabletDevice(userAgent)) return 'Tablet';
        return 'Desktop';
    }

    /**
     * Check if mobile device
     */
    isMobileDevice(userAgent) {
        return /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini|Windows Phone/i.test(userAgent);
    }

    /**
     * Check if tablet device
     */
    isTabletDevice(userAgent) {
        return /iPad|Android(?!.*Mobile)|Tablet|PlayBook|Kindle|Silk/i.test(userAgent);
    }

    // ==========================================
    // ===== NEW: HEAD DIRECTION METHODS =====
    // ==========================================

    /**
     * Update head direction based on angles
     * @param {number} angleX - Left/Right angle in degrees
     * @param {number} angleY - Up/Down angle in degrees
     * @param {number} angleZ - Tilt angle in degrees
     * @returns {string} Current head direction
     */
    updateHeadDirection(angleX, angleY, angleZ) {
        // Determine horizontal direction
        let horizontal = 'center';
        if (angleX < this.thresholds.LOOKING_LEFT) {
            horizontal = 'left';
        } else if (angleX > this.thresholds.LOOKING_RIGHT) {
            horizontal = 'right';
        }

        // Determine vertical direction
        let vertical = 'center';
        if (angleY < this.thresholds.LOOKING_UP) {
            vertical = 'up';
        } else if (angleY > this.thresholds.LOOKING_DOWN) {
            vertical = 'down';
        }

        // Combine directions
        let direction = 'center';
        if (horizontal === 'center' && vertical === 'center') direction = 'center';
        else if (horizontal === 'center' && vertical === 'up') direction = 'up';
        else if (horizontal === 'center' && vertical === 'down') direction = 'down';
        else if (horizontal === 'left' && vertical === 'center') direction = 'left';
        else if (horizontal === 'right' && vertical === 'center') direction = 'right';
        else if (horizontal === 'left' && vertical === 'up') direction = 'up_left';
        else if (horizontal === 'right' && vertical === 'up') direction = 'up_right';
        else if (horizontal === 'left' && vertical === 'down') direction = 'down_left';
        else if (horizontal === 'right' && vertical === 'down') direction = 'down_right';

        // Update history
        this.headDirections.previous = this.headDirections.current;
        this.headDirections.current = direction;
        this.headDirections.directionHistory.push({
            direction: direction,
            angleX: angleX,
            angleY: angleY,
            angleZ: angleZ,
            timestamp: new Date().toISOString()
        });

        // Keep history limited
        if (this.headDirections.directionHistory.length > this.thresholds.MAX_HISTORY) {
            this.headDirections.directionHistory.shift();
        }

        // Count directions
        if (direction === 'left' || direction === 'up_left' || direction === 'down_left') {
            this.headDirections.leftCount++;
        } else if (direction === 'right' || direction === 'up_right' || direction === 'down_right') {
            this.headDirections.rightCount++;
        } else if (direction === 'up' || direction === 'up_left' || direction === 'up_right') {
            this.headDirections.upCount++;
        } else if (direction === 'down' || direction === 'down_left' || direction === 'down_right') {
            this.headDirections.downCount++;
        } else {
            this.headDirections.centerCount++;
        }

        // Check for suspicious direction changes
        if (this.headDirections.previous !== 'center' && 
            this.headDirections.current !== 'center' &&
            this.headDirections.previous !== this.headDirections.current) {
            this.headDirections.suspiciousDirectionChanges++;
            this.headDirections.lastDirectionChange = new Date().toISOString();
        }

        return direction;
    }

    /**
     * Get head direction summary
     * @returns {Object} Head direction statistics
     */
    getHeadDirectionSummary() {
        const total = this.headDirections.leftCount + this.headDirections.rightCount + 
                      this.headDirections.upCount + this.headDirections.downCount + 
                      this.headDirections.centerCount;
        
        return {
            currentDirection: this.headDirections.current,
            previousDirection: this.headDirections.previous,
            leftCount: this.headDirections.leftCount,
            rightCount: this.headDirections.rightCount,
            upCount: this.headDirections.upCount,
            downCount: this.headDirections.downCount,
            centerCount: this.headDirections.centerCount,
            totalMovements: total,
            suspiciousChanges: this.headDirections.suspiciousDirectionChanges,
            lastChange: this.headDirections.lastDirectionChange,
            isLookingDown: this.headDirections.current.includes('down'),
            isLookingAway: this.headDirections.current !== 'center' && 
                          !this.headDirections.current.includes('down'),
            history: this.headDirections.directionHistory.slice(-10) // Last 10 movements
        };
    }

    /**
     * Check if head movement is suspicious
     * @returns {Object} Suspicion check result
     */
    checkSuspiciousHeadMovement() {
        const summary = this.getHeadDirectionSummary();
        let isSuspicious = false;
        let reason = '';

        // Check for excessive direction changes
        if (summary.suspiciousChanges > this.thresholds.DIRECTION_CHANGE_THRESHOLD) {
            isSuspicious = true;
            reason = `Excessive head direction changes (${summary.suspiciousChanges} in last minute)`;
        }

        // Check for looking down (possible phone/notes)
        if (summary.isLookingDown && summary.downCount > 5) {
            isSuspicious = true;
            reason = `Frequent looking down detected (${summary.downCount} times)`;
        }

        // Check for looking away repeatedly
        if (summary.isLookingAway && summary.totalMovements > 10) {
            isSuspicious = true;
            reason = `Repeatedly looking away from screen (${summary.totalMovements} times)`;
        }

        return {
            isSuspicious,
            reason,
            summary
        };
    }

    /**
     * Reset head direction tracking
     */
    resetHeadDirection() {
        this.headDirections = {
            current: 'center',
            previous: 'center',
            leftCount: 0,
            rightCount: 0,
            upCount: 0,
            downCount: 0,
            centerCount: 0,
            suspiciousDirectionChanges: 0,
            lastDirectionChange: null,
            directionHistory: []
        };
    }

    /**
     * Validate if device is allowed for exam
     */
    validateDevice(req, examRules = {}) {
        const deviceInfo = this.init(req);
        
        // Check allowed devices
        const allowedDevices = examRules.allowedDevices || ['desktop', 'laptop', 'all'];
        const deviceType = deviceInfo.deviceType.toLowerCase();
        
        if (!allowedDevices.includes(deviceType) && !allowedDevices.includes('all')) {
            return {
                valid: false,
                reason: `Device type '${deviceType}' not allowed for this exam`,
                deviceInfo: deviceInfo
            };
        }

        // Check for secondary devices (phones/tablets)
        if (this.detectSecondaryDevices(req)) {
            return {
                valid: false,
                reason: 'Secondary device detected (phone/tablet) near exam area',
                deviceInfo: deviceInfo,
                secondaryDevices: this.secondaryDevices
            };
        }

        // Check if webcam is available
        const webcamRequired = examRules.webcamRequired !== false;
        if (webcamRequired && !req.headers['x-webcam-enabled']) {
            return {
                valid: true,
                warning: 'Webcam not detected. Proctoring may be limited.',
                deviceInfo: deviceInfo
            };
        }

        return {
            valid: true,
            deviceInfo: deviceInfo,
            message: 'Device validated successfully'
        };
    }

    /**
     * Detect secondary devices
     */
    detectSecondaryDevices(req) {
        const hasMultipleDevices = this.checkMultipleDevices(req);
        
        if (hasMultipleDevices) {
            this.secondaryDevices.push({
                type: 'unknown',
                detectedAt: new Date().toISOString(),
                method: 'network_analysis',
                userAgent: req.headers['user-agent']
            });
        }
        
        return hasMultipleDevices;
    }

    /**
     * Check for multiple devices using network analysis
     */
    checkMultipleDevices(req) {
        const userAgent = req.headers['user-agent'] || '';
        const hasMobileUA = /Android|iPhone|iPad|iPod|Windows Phone/i.test(userAgent);
        const hasDesktopUA = /Windows|Mac|Linux|Ubuntu/i.test(userAgent);
        return hasMobileUA && hasDesktopUA;
    }

    /**
     * Start proctoring with head-down detection
     */
    startProctoring(examId, userId, options = {}) {
        this.examId = examId;
        this.userId = userId;
        this.proctoringSessionId = options.sessionId || `proctoring_${Date.now()}`;
        this.detectionStartTime = new Date().toISOString();
        this.totalViolations = 0;
        this.headDownEvents = 0;
        this.phoneDetectionEvents = 0;
        this.earphonesDetectionEvents = 0;
        this.booksDetectionEvents = 0;
        this.resetHeadDirection();

        if (this.phoneDetector) {
            this.phoneDetector.clearSuspiciousActivities();
        }

        if (this.phoneDetector) {
            const status = this.phoneDetector.getStatus();
            return {
                success: true,
                deviceInfo: this.deviceInfo,
                detectionStatus: status,
                examId: examId,
                userId: userId,
                sessionId: this.proctoringSessionId,
                startedAt: this.detectionStartTime,
                features: {
                    headDownDetection: true,
                    headDirectionTracking: true,
                    phoneDetection: true,
                    earphonesDetection: true,
                    booksDetection: true,
                    screenshotCapture: options.screenshots !== false,
                    realTimeMonitoring: true
                }
            };
        }
        return {
            success: false,
            message: 'Phone detection not initialized'
        };
    }

    /**
     * Get detection status with head direction
     */
    getDetectionStatus() {
        if (this.phoneDetector) {
            const status = this.phoneDetector.getStatus();
            const headSummary = this.getHeadDirectionSummary();
            const suspiciousCheck = this.checkSuspiciousHeadMovement();
            
            return {
                ...status,
                sessionId: this.proctoringSessionId,
                examId: this.examId,
                userId: this.userId,
                startedAt: this.detectionStartTime,
                totalViolations: this.totalViolations,
                headDownEvents: this.headDownEvents,
                phoneDetectionEvents: this.phoneDetectionEvents,
                earphonesDetectionEvents: this.earphonesDetectionEvents,
                booksDetectionEvents: this.booksDetectionEvents,
                isProctoringActive: this.isDetectionActive,
                headDirection: {
                    current: headSummary.currentDirection,
                    previous: headSummary.previousDirection,
                    stats: {
                        left: headSummary.leftCount,
                        right: headSummary.rightCount,
                        up: headSummary.upCount,
                        down: headSummary.downCount,
                        center: headSummary.centerCount,
                        total: headSummary.totalMovements
                    },
                    isLookingDown: headSummary.isLookingDown,
                    isLookingAway: headSummary.isLookingAway,
                    suspiciousChanges: headSummary.suspiciousChanges,
                    lastChange: headSummary.lastChange,
                    isSuspicious: suspiciousCheck.isSuspicious,
                    suspiciousReason: suspiciousCheck.reason,
                    recentMovements: headSummary.history
                }
            };
        }
        return {
            isProctoringActive: false,
            message: 'No detection active'
        };
    }

    /**
     * Get suspicious activities with filters
     */
    getSuspiciousActivities(filters = {}) {
        let activities = [];
        
        if (this.phoneDetector) {
            activities = this.phoneDetector.getSuspiciousActivities();
        }
        
        // Apply filters
        if (filters.type) {
            activities = activities.filter(a => a.type === filters.type);
        }
        
        if (filters.severity) {
            activities = activities.filter(a => a.severity === filters.severity);
        }
        
        if (filters.startDate) {
            const start = new Date(filters.startDate);
            activities = activities.filter(a => new Date(a.timestamp) >= start);
        }
        
        if (filters.endDate) {
            const end = new Date(filters.endDate);
            activities = activities.filter(a => new Date(a.timestamp) <= end);
        }
        
        activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        return activities;
    }

    /**
     * Log suspicious activity
     */
    async logSuspiciousActivity(req, activityData) {
        try {
            this.totalViolations++;
            
            if (activityData.type === 'head_down') {
                this.headDownEvents++;
            } else if (activityData.type === 'phone_detection') {
                this.phoneDetectionEvents++;
            } else if (activityData.type === 'earphones_detection') {
                this.earphonesDetectionEvents++;
            } else if (activityData.type === 'books_detection') {
                this.booksDetectionEvents++;
            }

            // Add head direction context
            const headSummary = this.getHeadDirectionSummary();
            const suspiciousCheck = this.checkSuspiciousHeadMovement();

            const log = new CheatingLog({
                examId: activityData.examId || this.examId,
                userId: activityData.userId || this.userId,
                type: activityData.type || 'phone_detection',
                severity: activityData.severity || 'medium',
                details: {
                    deviceInfo: this.deviceInfo,
                    sessionId: this.proctoringSessionId,
                    headDown: activityData.details?.headDown || false,
                    phoneDetected: activityData.details?.phoneDetected || false,
                    earphonesDetected: activityData.details?.earphonesDetected || false,
                    booksDetected: activityData.details?.booksDetected || false,
                    confidence: activityData.details?.confidence || 0.85,
                    screenshot: activityData.details?.screenshot || null,
                    // ===== NEW: Head direction context =====
                    headDirection: {
                        current: headSummary.currentDirection,
                        previous: headSummary.previousDirection,
                        isLookingDown: headSummary.isLookingDown,
                        isLookingAway: headSummary.isLookingAway,
                        suspiciousChanges: headSummary.suspiciousChanges,
                        recentMovements: headSummary.history.slice(-5)
                    },
                    isSuspiciousHeadMovement: suspiciousCheck.isSuspicious,
                    suspiciousReason: suspiciousCheck.reason,
                    ...activityData.details
                },
                timestamp: new Date(activityData.timestamp) || new Date()
            });
            
            await log.save();
            
            if (this.phoneDetector) {
                this.phoneDetector.addSuspiciousActivity({
                    type: activityData.type || 'phone_detection',
                    timestamp: new Date().toISOString(),
                    severity: activityData.severity || 'medium',
                    details: {
                        ...activityData.details,
                        logId: log._id,
                        headDirection: headSummary.currentDirection
                    }
                });
            }
            
            console.log(`🚨 Violation #${this.totalViolations} logged: ${activityData.type} - Head: ${headSummary.currentDirection}`);
            return log;
        } catch (error) {
            console.error('Failed to log suspicious activity:', error);
            return null;
        }
    }

    /**
     * Check for active violations in real-time
     */
    checkActiveViolations() {
        if (!this.phoneDetector) {
            return null;
        }
        
        const status = this.phoneDetector.getStatus();
        const headSummary = this.getHeadDirectionSummary();
        const suspiciousCheck = this.checkSuspiciousHeadMovement();
        
        // Check for suspicious head movement
        if (suspiciousCheck.isSuspicious) {
            return {
                type: 'suspicious_head_movement',
                severity: 'medium',
                timestamp: new Date().toISOString(),
                details: {
                    reason: suspiciousCheck.reason,
                    headDirection: headSummary.currentDirection,
                    movements: headSummary
                }
            };
        }
        
        if (status.isHeadDown && status.phoneDetected) {
            return {
                type: 'phone_detection',
                severity: 'high',
                timestamp: new Date().toISOString(),
                details: {
                    headDown: status.isHeadDown,
                    phoneDetected: status.phoneDetected,
                    earphonesDetected: status.earphonesDetected,
                    booksDetected: status.booksDetected,
                    headDirection: headSummary.currentDirection
                }
            };
        }
        
        if (status.isHeadDown && status.earphonesDetected) {
            return {
                type: 'earphones_detection',
                severity: 'medium',
                timestamp: new Date().toISOString(),
                details: {
                    headDown: status.isHeadDown,
                    earphonesDetected: status.earphonesDetected,
                    headDirection: headSummary.currentDirection
                }
            };
        }
        
        if (status.isHeadDown && status.booksDetected) {
            return {
                type: 'books_detection',
                severity: 'medium',
                timestamp: new Date().toISOString(),
                details: {
                    headDown: status.isHeadDown,
                    booksDetected: status.booksDetected,
                    headDirection: headSummary.currentDirection
                }
            };
        }
        
        return null;
    }

    /**
     * Get violation statistics with head direction data
     */
    getViolationStats() {
        const headSummary = this.getHeadDirectionSummary();
        
        return {
            totalViolations: this.totalViolations,
            headDownEvents: this.headDownEvents,
            phoneDetectionEvents: this.phoneDetectionEvents,
            earphonesDetectionEvents: this.earphonesDetectionEvents,
            booksDetectionEvents: this.booksDetectionEvents,
            suspiciousActivities: this.suspiciousActivities.length,
            sessionId: this.proctoringSessionId,
            examId: this.examId,
            userId: this.userId,
            startedAt: this.detectionStartTime,
            isActive: this.isDetectionActive,
            headDirection: {
                current: headSummary.currentDirection,
                leftCount: headSummary.leftCount,
                rightCount: headSummary.rightCount,
                upCount: headSummary.upCount,
                downCount: headSummary.downCount,
                centerCount: headSummary.centerCount,
                totalMovements: headSummary.totalMovements,
                suspiciousChanges: headSummary.suspiciousChanges
            }
        };
    }

    /**
     * Generate proctoring report
     */
    generateReport() {
        const status = this.getDetectionStatus();
        const violations = this.getSuspiciousActivities();
        const headSummary = this.getHeadDirectionSummary();
        
        return {
            sessionId: this.proctoringSessionId,
            examId: this.examId,
            userId: this.userId,
            deviceInfo: this.deviceInfo,
            startedAt: this.detectionStartTime,
            endedAt: new Date().toISOString(),
            duration: this.detectionStartTime ? 
                (new Date() - new Date(this.detectionStartTime)) / 1000 / 60 : 0,
            statistics: this.getViolationStats(),
            violations: violations.slice(0, 50),
            headDirectionSummary: {
                mostCommonDirection: this.getMostCommonDirection(),
                totalMovements: headSummary.totalMovements,
                suspiciousChanges: headSummary.suspiciousChanges,
                lastChange: headSummary.lastChange,
                directionDistribution: {
                    left: headSummary.leftCount,
                    right: headSummary.rightCount,
                    up: headSummary.upCount,
                    down: headSummary.downCount,
                    center: headSummary.centerCount
                }
            },
            summary: {
                totalViolations: this.totalViolations,
                criticalViolations: violations.filter(v => v.severity === 'critical').length,
                highViolations: violations.filter(v => v.severity === 'high').length,
                mediumViolations: violations.filter(v => v.severity === 'medium').length,
                lowViolations: violations.filter(v => v.severity === 'low').length,
                mostCommonViolation: this.getMostCommonViolation(violations),
                headLookingDownPercentage: headSummary.downCount / (headSummary.totalMovements || 1) * 100
            },
            status: status
        };
    }

    /**
     * Get most common direction
     */
    getMostCommonDirection() {
        const summary = this.getHeadDirectionSummary();
        const directions = {
            left: summary.leftCount,
            right: summary.rightCount,
            up: summary.upCount,
            down: summary.downCount,
            center: summary.centerCount
        };
        
        let maxCount = 0;
        let mostCommon = 'center';
        for (const [direction, count] of Object.entries(directions)) {
            if (count > maxCount) {
                maxCount = count;
                mostCommon = direction;
            }
        }
        return mostCommon;
    }

    /**
     * Get most common violation type
     */
    getMostCommonViolation(violations) {
        if (violations.length === 0) return 'none';
        
        const types = {};
        violations.forEach(v => {
            types[v.type] = (types[v.type] || 0) + 1;
        });
        
        let maxCount = 0;
        let mostCommon = 'unknown';
        for (const [type, count] of Object.entries(types)) {
            if (count > maxCount) {
                maxCount = count;
                mostCommon = type;
            }
        }
        return mostCommon;
    }

    /**
     * Stop proctoring and cleanup
     */
    stopProctoring() {
        const report = this.generateReport();
        
        if (this.phoneDetector) {
            this.phoneDetector.stop();
            this.isDetectionActive = false;
        }
        
        console.log(`🛑 Proctoring stopped for session: ${this.proctoringSessionId}`);
        
        return {
            success: true,
            sessionId: this.proctoringSessionId,
            stoppedAt: new Date().toISOString(),
            report: report
        };
    }

    /**
     * Reset all tracking data
     */
    reset() {
        this.suspiciousActivities = [];
        this.secondaryDevices = [];
        this.totalViolations = 0;
        this.headDownEvents = 0;
        this.phoneDetectionEvents = 0;
        this.earphonesDetectionEvents = 0;
        this.booksDetectionEvents = 0;
        this.proctoringSessionId = null;
        this.examId = null;
        this.userId = null;
        this.detectionStartTime = null;
        this.resetHeadDirection();
        
        if (this.phoneDetector) {
            this.phoneDetector.clearSuspiciousActivities();
        }
        
        console.log('🔄 Device validator reset');
    }

    /**
     * Update device info from request
     */
    updateDeviceInfo(req) {
        const newInfo = {
            userAgent: req.headers['user-agent'] || this.deviceInfo.userAgent,
            platform: req.headers['sec-ch-ua-platform'] || this.deviceInfo.platform,
            screenResolution: req.headers['viewport'] || this.deviceInfo.screenResolution,
            ipAddress: req.ip || req.connection?.remoteAddress || this.deviceInfo.ipAddress,
            lastUpdated: new Date().toISOString()
        };
        
        this.deviceInfo = { ...this.deviceInfo, ...newInfo };
        return this.deviceInfo;
    }
}

// Singleton instance
let deviceValidatorInstance = null;

/**
 * Get or create DeviceValidator instance
 */
function getDeviceValidator() {
    if (!deviceValidatorInstance) {
        deviceValidatorInstance = new DeviceValidator();
    }
    return deviceValidatorInstance;
}

module.exports = {
    DeviceValidator,
    getDeviceValidator
};