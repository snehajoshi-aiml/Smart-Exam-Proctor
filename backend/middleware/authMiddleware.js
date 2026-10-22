// backend/middleware/authMiddleware.js
const jwt = require("jsonwebtoken");
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const User = require("../models/userModel.js");


// ==========================================
// ===== HEAD MOVEMENT DETECTOR CLASS =====
// ==========================================

class HeadMovementDetector {
    constructor() {
        this.directions = {
            STRAIGHT: 'straight',
            UP: 'up',
            DOWN: 'down',
            LEFT: 'left',
            RIGHT: 'right'
        };
        
        this.thresholds = {
            pitchUp: -10,
            pitchDown: 10,
            yawLeft: -12,
            yawRight: 12
        };
        
        this.currentDirection = this.directions.STRAIGHT;
        this.previousDirection = this.directions.STRAIGHT;
        this.isHeadDown = false;
        this.history = [];
        this.maxHistory = 30;
        this.directionCounts = { straight: 0, up: 0, down: 0, left: 0, right: 0 };
        this.violations = [];
        this.lastViolationTime = 0;
        this.violationCooldown = 2000;
        
        // Detection state
        this.phoneDetected = false;
        this.booksDetected = false;
        this.earphonesDetected = false;
        this.faceDetected = false;
        this.totalMovements = 0;
    }

    processHeadPose(pitch, yaw, detections = {}) {
        const normalizedPitch = this.normalizeAngle(pitch);
        const normalizedYaw = this.normalizeAngle(yaw);
        
        this.phoneDetected = detections.phone || false;
        this.booksDetected = detections.books || false;
        this.earphonesDetected = detections.earphones || false;
        this.faceDetected = detections.face !== false;
        
        const direction = this.determineDirection(normalizedPitch, normalizedYaw);
        const isHeadDown = this.checkHeadDown(normalizedPitch);
        
        this.previousDirection = this.currentDirection;
        this.currentDirection = direction;
        this.isHeadDown = isHeadDown;
        
        this.addToHistory(direction, isHeadDown, normalizedPitch, normalizedYaw);
        this.updateDirectionCounts(direction);
        this.totalMovements++;
        
        const violations = this.checkViolations(direction, isHeadDown);
        
        return {
            direction: this.currentDirection,
            previousDirection: this.previousDirection,
            isHeadDown: this.isHeadDown,
            pitch: normalizedPitch,
            yaw: normalizedYaw,
            phoneDetected: this.phoneDetected,
            booksDetected: this.booksDetected,
            earphonesDetected: this.earphonesDetected,
            faceDetected: this.faceDetected,
            violations: violations,
            directionCounts: this.directionCounts,
            history: this.history.slice(-10)
        };
    }

    determineDirection(pitch, yaw) {
        let vertical = this.directions.STRAIGHT;
        if (pitch < this.thresholds.pitchUp) vertical = this.directions.UP;
        else if (pitch > this.thresholds.pitchDown) vertical = this.directions.DOWN;
        
        let horizontal = this.directions.STRAIGHT;
        if (yaw < this.thresholds.yawLeft) horizontal = this.directions.LEFT;
        else if (yaw > this.thresholds.yawRight) horizontal = this.directions.RIGHT;
        
        if (vertical !== this.directions.STRAIGHT && horizontal !== this.directions.STRAIGHT) {
            const pitchMag = Math.abs(pitch);
            const yawMag = Math.abs(yaw);
            if (pitchMag > yawMag * 1.2) return vertical;
            else if (yawMag > pitchMag * 1.2) return horizontal;
            else return `${vertical}_${horizontal}`;
        }
        
        return vertical !== this.directions.STRAIGHT ? vertical : horizontal;
    }

    checkHeadDown(pitch) {
        return pitch > this.thresholds.pitchDown;
    }

    addToHistory(direction, isHeadDown, pitch, yaw) {
        this.history.push({
            direction,
            isHeadDown,
            pitch,
            yaw,
            timestamp: Date.now(),
            phoneDetected: this.phoneDetected,
            booksDetected: this.booksDetected,
            earphonesDetected: this.earphonesDetected
        });
        if (this.history.length > this.maxHistory) {
            this.history.shift();
        }
    }

    updateDirectionCounts(direction) {
        if (direction !== this.directions.STRAIGHT && !direction.includes('_')) {
            this.directionCounts[direction] = (this.directionCounts[direction] || 0) + 1;
        }
    }

    checkViolations(direction, isHeadDown) {
        const now = Date.now();
        const violations = [];
        
        if (now - this.lastViolationTime < this.violationCooldown) {
            return violations;
        }
        
        // Head down with objects detection
        if (isHeadDown) {
            if (this.phoneDetected) {
                violations.push({
                    type: 'phone_detected_with_head_down',
                    severity: 'high',
                    message: '📱 Phone detected while looking down!',
                    timestamp: new Date().toISOString()
                });
                this.lastViolationTime = now;
            }
            
            if (this.booksDetected) {
                violations.push({
                    type: 'books_detected_with_head_down',
                    severity: 'medium',
                    message: '📚 Books detected while looking down!',
                    timestamp: new Date().toISOString()
                });
                this.lastViolationTime = now;
            }
            
            if (this.earphonesDetected) {
                violations.push({
                    type: 'earphones_detected_with_head_down',
                    severity: 'medium',
                    message: '🎧 Earphones detected while looking down!',
                    timestamp: new Date().toISOString()
                });
                this.lastViolationTime = now;
            }
        }
        
        // Check for excessive head movement
        if (this.history.length >= 10) {
            const recent = this.history.slice(-10);
            const nonStraight = recent.filter(m => 
                m.direction !== this.directions.STRAIGHT && !m.direction.includes('_')
            );
            if (nonStraight.length > 6) {
                violations.push({
                    type: 'excessive_head_movement',
                    severity: 'low',
                    message: `⚠️ Excessive head movement detected (${nonStraight.length} changes in 10 frames)`,
                    timestamp: new Date().toISOString()
                });
                this.lastViolationTime = now;
            }
        }
        
        return violations;
    }

    normalizeAngle(angle) {
        if (typeof angle !== 'number' || isNaN(angle)) return 0;
        let normalized = angle % 360;
        if (normalized > 180) normalized -= 360;
        if (normalized < -180) normalized += 360;
        return normalized;
    }

    getStatus() {
        return {
            currentDirection: this.currentDirection,
            previousDirection: this.previousDirection,
            isHeadDown: this.isHeadDown,
            phoneDetected: this.phoneDetected,
            booksDetected: this.booksDetected,
            earphonesDetected: this.earphonesDetected,
            faceDetected: this.faceDetected,
            directionCounts: this.directionCounts,
            totalMovements: this.totalMovements,
            violations: this.violations.slice(-10),
            recentHistory: this.history.slice(-5)
        };
    }

    reset() {
        this.currentDirection = this.directions.STRAIGHT;
        this.previousDirection = this.directions.STRAIGHT;
        this.isHeadDown = false;
        this.history = [];
        this.directionCounts = { straight: 0, up: 0, down: 0, left: 0, right: 0 };
        this.violations = [];
        this.lastViolationTime = 0;
        this.phoneDetected = false;
        this.booksDetected = false;
        this.earphonesDetected = false;
        this.totalMovements = 0;
    }
}

// ==========================================
// ===== MAIN AUTHENTICATION MIDDLEWARE =====
// ==========================================

const protect = asyncHandler(async (req, res, next) => {
    // Get token from cookie
    let token = req.cookies.jwt;

    // Also check Authorization header (for mobile/API clients)
    if (!token) {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7);
        }
    }

    // Cookie present
    if (token) {
        try {
            // Verify JWT
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            
            // Get user without password
            req.user = await User.findById(decoded.userId).select("-password");
            
            if (!req.user) {
                res.status(401);
                throw new Error("User not found");
            }

            // ==========================================
            // ===== DEVICE VALIDATION & DETECTION =====
            // ==========================================
            
            // Initialize device validator
            const validator = getDeviceValidator();
            req.deviceValidator = validator;
            
            // Detect and validate device
            const deviceInfo = validator.init(req);
            req.deviceInfo = deviceInfo;
            
            // Check if device is mobile/tablet
            req.isMobileDevice = deviceInfo.isPhone || deviceInfo.isTablet;
            req.deviceType = deviceInfo.deviceType; // 'desktop', 'phone', 'tablet'
            
            // ==========================================
            // ===== HEAD MOVEMENT DETECTION =====
            // ==========================================
            
            // Initialize head movement detector if not exists
            if (!req.headMovementDetector) {
                req.headMovementDetector = new HeadMovementDetector();
            }
            
            // Get head pose data from headers
            const headPose = {
                pitch: parseFloat(req.headers['x-head-pitch'] || 0),
                yaw: parseFloat(req.headers['x-head-yaw'] || 0),
                roll: parseFloat(req.headers['x-head-roll'] || 0)
            };
            
            // Get detection results from headers
            const detections = {
                phone: req.headers['x-phone-detected'] === 'true',
                books: req.headers['x-books-detected'] === 'true',
                earphones: req.headers['x-earphones-detected'] === 'true',
                face: req.headers['x-face-detected'] !== 'false'
            };
            
            // Process head movement
            const headMovementResult = req.headMovementDetector.processHeadPose(
                headPose.pitch,
                headPose.yaw,
                detections
            );
            
            // Attach head movement data to request
            req.headMovement = headMovementResult;
            req.headDirection = headMovementResult.direction;
            req.isHeadDown = headMovementResult.isHeadDown;
            req.phoneDetected = headMovementResult.phoneDetected;
            req.booksDetected = headMovementResult.booksDetected;
            req.earphonesDetected = headMovementResult.earphonesDetected;
            req.directionCounts = headMovementResult.directionCounts;
            
            // ==========================================
            // ===== PROCTORING DETECTION INIT =====
            // ==========================================
            
            // Check if proctoring is enabled (via header, query, or cookie)
            const proctoringEnabled = 
                req.headers['x-enable-proctoring'] === 'true' ||
                req.query.enableProctoring === 'true' ||
                req.cookies.enableProctoring === 'true' ||
                req.body.enableProctoring === true;

            // Check if exam is active (via header, query, or cookie)
            const examId = 
                req.headers['x-exam-id'] ||
                req.query.examId ||
                req.cookies.examId ||
                req.body.examId;

            // Initialize phone detection if proctoring is enabled
            if (proctoringEnabled) {
                if (!validator.phoneDetector) {
                    validator.phoneDetector = new PhoneDetection();
                    validator.phoneDetector.init(deviceInfo, {
                        type: 'secondary_device',
                        status: 'proctoring_active',
                        examId: examId || 'unknown'
                    });
                    validator.isDetectionActive = true;
                    
                    console.log('🔍 Phone detection initialized for user:', req.user._id);
                }
                
                // Attach detection status to request
                req.detectionStatus = validator.phoneDetector.getStatus();
                req.isDetectionActive = true;
                
                // Check for suspicious activities in this session
                const suspiciousActivities = validator.phoneDetector.getSuspiciousActivities();
                req.suspiciousCount = suspiciousActivities.length;
                req.hasSuspiciousActivity = suspiciousActivities.length > 0;
                
                // Log user activity with head movement
                console.log(`👤 User ${req.user.email} - Device: ${deviceInfo.deviceType} - Proctoring: Active - Head: ${headMovementResult.direction}`);
            } else {
                req.isDetectionActive = false;
                req.detectionStatus = null;
                console.log(`👤 User ${req.user.email} - Device: ${deviceInfo.deviceType} - Proctoring: Inactive - Head: ${headMovementResult.direction}`);
            }
            
            // ==========================================
            // ===== HEAD-DOWN DETECTION CHECK =====
            // ==========================================
            
            // Check if head-down detection is enabled
            const headDownDetectionEnabled = 
                req.headers['x-head-down-detection'] === 'true' ||
                req.query.headDownDetection === 'true' ||
                req.cookies.headDownDetection === 'true';

            if (headDownDetectionEnabled && validator.phoneDetector) {
                req.headDownDetectionEnabled = true;
                
                // Get current head-down status from head movement
                req.isHeadDown = headMovementResult.isHeadDown;
                req.phoneDetected = headMovementResult.phoneDetected;
                req.earphonesDetected = headMovementResult.earphonesDetected;
                req.booksDetected = headMovementResult.booksDetected;
                req.headDirection = headMovementResult.direction;
                
                // Check for active violations from head movement
                if (headMovementResult.violations && headMovementResult.violations.length > 0) {
                    // Get the first violation as active violation
                    req.activeViolation = headMovementResult.violations[0];
                    req.activeViolations = headMovementResult.violations;
                    
                    // Log the violation
                    console.log(`🚨 Active violation detected for user ${req.user.email}: ${headMovementResult.violations[0].message}`);
                    
                    // Add to phone detector's suspicious activities
                    if (validator.phoneDetector) {
                        for (const violation of headMovementResult.violations) {
                            validator.phoneDetector.addSuspiciousActivity({
                                type: violation.type,
                                severity: violation.severity,
                                details: {
                                    message: violation.message,
                                    headDirection: headMovementResult.direction,
                                    isHeadDown: headMovementResult.isHeadDown,
                                    phoneDetected: headMovementResult.phoneDetected,
                                    booksDetected: headMovementResult.booksDetected,
                                    earphonesDetected: headMovementResult.earphonesDetected,
                                    timestamp: violation.timestamp
                                }
                            });
                        }
                    }
                }
            } else {
                req.headDownDetectionEnabled = false;
                // Don't override existing values if head-down detection is disabled
                // but keep the head movement data
            }
            
            // ==========================================
            // ===== ATTACH DETECTION METHODS =====
            // ==========================================
            
            // Add helper methods to request for detection
            req.getDetectionStatus = () => {
                if (validator.phoneDetector) {
                    const baseStatus = validator.phoneDetector.getStatus();
                    return {
                        ...baseStatus,
                        headMovement: req.headMovementDetector.getStatus(),
                        headDirection: req.headMovementDetector.currentDirection,
                        isHeadDown: req.headMovementDetector.isHeadDown,
                        headDownDuration: req.headMovementDetector.headDownDuration || 0,
                        directionCounts: req.headMovementDetector.directionCounts
                    };
                }
                return null;
            };
            
            req.getSuspiciousActivities = () => {
                if (validator.phoneDetector) {
                    const baseActivities = validator.phoneDetector.getSuspiciousActivities();
                    // Add head movement violations
                    const headViolations = req.headMovementDetector.violations || [];
                    return [...baseActivities, ...headViolations];
                }
                return [];
            };
            
            req.reportViolation = async (type, details, severity = 'medium') => {
                if (validator.phoneDetector) {
                    const violation = {
                        type: type || 'suspicious_activity',
                        severity: severity,
                        details: {
                            ...details,
                            deviceInfo: deviceInfo,
                            userId: req.user._id,
                            email: req.user.email,
                            headDirection: req.headMovementDetector.currentDirection,
                            isHeadDown: req.headMovementDetector.isHeadDown,
                            directionCounts: req.headMovementDetector.directionCounts,
                            phoneDetected: req.headMovementDetector.phoneDetected,
                            booksDetected: req.headMovementDetector.booksDetected,
                            earphonesDetected: req.headMovementDetector.earphonesDetected
                        },
                        timestamp: new Date().toISOString()
                    };
                    
                    validator.phoneDetector.addSuspiciousActivity(violation);
                    
                    // Also add to head movement detector
                    if (req.headMovementDetector) {
                        req.headMovementDetector.violations.push(violation);
                    }
                    
                    // Save to database if controller available
                    if (req.proctoringController && req.proctoringController.saveViolation) {
                        await req.proctoringController.saveViolation({
                            examId: examId || 'unknown',
                            userId: req.user._id,
                            ...violation
                        });
                    }
                    
                    return violation;
                }
                return null;
            };
            
            // ==========================================
            // ===== MOBILE DEVICE BLOCK CHECK =====
            // ==========================================
            
            // Check if mobile devices are blocked for this exam
            const blockMobile = 
                req.headers['x-block-mobile'] === 'true' ||
                req.query.blockMobile === 'true' ||
                req.cookies.blockMobile === 'true';

            if (blockMobile && req.isMobileDevice) {
                console.log(`🚫 Mobile device blocked for user ${req.user.email}`);
                
                // Log the attempt
                if (validator.phoneDetector) {
                    validator.phoneDetector.addSuspiciousActivity({
                        type: 'blocked_mobile_attempt',
                        severity: 'high',
                        details: {
                            deviceInfo: deviceInfo,
                            userEmail: req.user.email,
                            timestamp: new Date().toISOString()
                        }
                    });
                }
                
                // Still allow the request but flag it
                req.isMobileBlocked = true;
                req.mobileBlockMessage = 'Mobile devices are not allowed for this exam';
            } else {
                req.isMobileBlocked = false;
            }
            
            // ==========================================
            // ===== SESSION AUDIT LOG =====
            // ==========================================
            
            // Log this authentication event with head movement data
            console.log(`✅ Auth successful: ${req.user.email} | Device: ${deviceInfo.deviceType} | Proctoring: ${proctoringEnabled ? 'Active' : 'Inactive'} | Head-Down: ${req.headDownDetectionEnabled ? 'Enabled' : 'Disabled'} | Head Direction: ${req.headMovementDetector.currentDirection} | Direction Counts: ${JSON.stringify(req.headMovementDetector.directionCounts)} | Violations: ${req.headMovementDetector.violations?.length || 0}`);
            
            // Continue to next middleware
            next();
            
        } catch (error) {
            console.error('Auth error:', error.message);
            
            if (error.name === 'JsonWebTokenError') {
                res.status(401);
                throw new Error("Invalid token");
            } else if (error.name === 'TokenExpiredError') {
                res.status(401);
                throw new Error("Token expired");
            } else {
                res.status(401);
                throw new Error("Not Authorized, Invalid Token");
            }
        }
    } else {
        // No token present
        res.status(401);
        throw new Error("Not Authorized, No Token");
    }
});

// ==========================================
// ===== OPTIONAL AUTH MIDDLEWARE =====
// ==========================================

/**
 * Optional authentication - doesn't throw error if no token
 * Useful for routes that can work with or without authentication
 */
const optionalAuth = asyncHandler(async (req, res, next) => {
    try {
        let token = req.cookies.jwt;
        
        if (!token) {
            const authHeader = req.headers.authorization;
            if (authHeader && authHeader.startsWith('Bearer ')) {
                token = authHeader.substring(7);
            }
        }
        
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = await User.findById(decoded.userId).select("-password");
            
            // Attach detection features if user exists
            if (req.user) {
                const validator = getDeviceValidator();
                req.deviceValidator = validator;
                req.deviceInfo = validator.init(req);
                
                // Initialize head movement detector
                req.headMovementDetector = new HeadMovementDetector();
                
                // Initialize detection if proctoring enabled
                const proctoringEnabled = req.headers['x-enable-proctoring'] === 'true';
                if (proctoringEnabled && !validator.phoneDetector) {
                    validator.phoneDetector = new PhoneDetection();
                    validator.phoneDetector.init(req.deviceInfo, {
                        type: 'secondary_device',
                        status: 'proctoring_active'
                    });
                    validator.isDetectionActive = true;
                }
                
                req.isAuthenticated = true;
            }
        } else {
            req.isAuthenticated = false;
        }
    } catch (error) {
        // Don't throw error, just set as unauthenticated
        req.isAuthenticated = false;
        console.warn('Optional auth failed:', error.message);
    }
    
    next();
});

// ==========================================
// ===== ROLE-BASED AUTH MIDDLEWARE =====
// ==========================================

/**
 * Check if user has required role
 * @param {string|string[]} roles - Role or array of roles allowed
 */
const requireRole = (roles) => {
    return asyncHandler(async (req, res, next) => {
        if (!req.user) {
            res.status(401);
            throw new Error("Not authenticated");
        }
        
        const userRoles = req.user.roles || ['student'];
        const allowedRoles = Array.isArray(roles) ? roles : [roles];
        
        const hasRole = userRoles.some(role => allowedRoles.includes(role));
        
        if (!hasRole) {
            res.status(403);
            throw new Error(`Access denied. Required role: ${allowedRoles.join(' or ')}`);
        }
        
        next();
    });
};

// ==========================================
// ===== PROCTORING ENABLED MIDDLEWARE =====
// ==========================================

/**
 * Middleware to ensure proctoring is active
 */
const requireProctoring = asyncHandler(async (req, res, next) => {
    if (!req.isDetectionActive || !req.deviceValidator?.phoneDetector) {
        res.status(403);
        throw new Error("Proctoring not active. Please enable proctoring.");
    }
    
    // Check if there are active violations
    if (req.activeViolation) {
        // Allow but flag
        console.warn('⚠️ Active violation detected during proctoring');
    }
    
    next();
});

// ==========================================
// ===== DETECTION STATUS MIDDLEWARE =====
// ==========================================

/**
 * Get current detection status and attach to response
 */
const attachDetectionStatus = asyncHandler(async (req, res, next) => {
    if (req.deviceValidator?.phoneDetector) {
        const status = req.deviceValidator.phoneDetector.getStatus();
        res.locals.detectionStatus = status;
        res.locals.suspiciousActivities = req.deviceValidator.phoneDetector.getSuspiciousActivities();
        
        // Attach head movement status
        if (req.headMovementDetector) {
            res.locals.headMovementStatus = req.headMovementDetector.getStatus();
            res.locals.directionCounts = req.headMovementDetector.directionCounts;
        }
    }
    next();
});

module.exports = { 
    protect, 
    optionalAuth, 
    requireRole, 
    requireProctoring,
    attachDetectionStatus,
    HeadMovementDetector
};