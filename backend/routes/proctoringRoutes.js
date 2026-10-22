const express = require('express');
const router = express.Router();

// Import controller
const proctoringController = require('../controllers/proctoringController');
const { getDeviceValidator } = require('../middleware/deviceValidator');

// Import Phone Detection
const PhoneDetection = require('../utils/phoneDetection');

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
    
    // Thresholds for detection (in degrees)
    this.thresholds = {
      pitchUp: -12,     // degrees - looking up
      pitchDown: 12,    // degrees - looking down
      yawLeft: -15,     // degrees - looking left
      yawRight: 15      // degrees - looking right
    };
    
    // Current state
    this.currentDirection = this.directions.STRAIGHT;
    this.previousDirection = this.directions.STRAIGHT;
    this.isHeadDown = false;
    this.headMovementHistory = [];
    this.maxHistorySize = 20;
    
    // Detection state
    this.phoneDetected = false;
    this.booksDetected = false;
    this.earphonesDetected = false;
    this.faceDetected = false;
    
    // Head-down specific state
    this.headDownStartTime = null;
    this.headDownDuration = 0;
    this.isHeadDownActive = false;
    
    // Movement patterns
    this.suspiciousPatterns = [];
  }

  /**
   * Process head pose data from frontend
   */
  processHeadPose(headPose, detectionResults = {}) {
    const { pitch = 0, yaw = 0, roll = 0 } = headPose;
    
    // Update detection results
    this.phoneDetected = detectionResults.phone || false;
    this.booksDetected = detectionResults.books || false;
    this.earphonesDetected = detectionResults.earphones || false;
    this.faceDetected = detectionResults.face !== undefined ? detectionResults.face : true;
    
    // Determine head direction
    let direction = this.determineDirection(pitch, yaw);
    
    // Check if head is down (specific for downward detection)
    const isHeadDown = this.checkHeadDown(pitch);
    
    // Update state
    this.previousDirection = this.currentDirection;
    this.currentDirection = direction;
    this.isHeadDown = isHeadDown;
    
    // Add to history
    this.headMovementHistory.push({
      direction,
      isHeadDown,
      pitch,
      yaw,
      roll,
      timestamp: Date.now(),
      phoneDetected: this.phoneDetected,
      booksDetected: this.booksDetected,
      earphonesDetected: this.earphonesDetected
    });
    
    if (this.headMovementHistory.length > this.maxHistorySize) {
      this.headMovementHistory.shift();
    }
    
    // Update head-down state
    this.updateHeadDownState(isHeadDown);
    
    // Check for combined violations (head down + objects)
    const violations = this.checkViolations(direction, isHeadDown);
    
    // Detect suspicious movement patterns
    const patterns = this.detectSuspiciousPatterns();
    
    return {
      direction,
      previousDirection: this.previousDirection,
      isHeadDown,
      headDownDuration: this.headDownDuration,
      isHeadDownActive: this.isHeadDownActive,
      phoneDetected: this.phoneDetected,
      booksDetected: this.booksDetected,
      earphonesDetected: this.earphonesDetected,
      faceDetected: this.faceDetected,
      violations: violations,
      patterns: patterns,
      history: this.headMovementHistory.slice(-10)
    };
  }

  /**
   * Determine head direction based on pitch and yaw
   */
  determineDirection(pitch, yaw) {
    // Normalize angles
    const normalizedPitch = this.normalizeAngle(pitch);
    const normalizedYaw = this.normalizeAngle(yaw);
    
    // Determine vertical direction (pitch)
    let vertical = this.directions.STRAIGHT;
    if (normalizedPitch < this.thresholds.pitchUp) {
      vertical = this.directions.UP;
    } else if (normalizedPitch > this.thresholds.pitchDown) {
      vertical = this.directions.DOWN;
    }
    
    // Determine horizontal direction (yaw)
    let horizontal = this.directions.STRAIGHT;
    if (normalizedYaw < this.thresholds.yawLeft) {
      horizontal = this.directions.LEFT;
    } else if (normalizedYaw > this.thresholds.yawRight) {
      horizontal = this.directions.RIGHT;
    }
    
    // Determine primary direction
    // If both vertical and horizontal are not straight, determine which is more prominent
    if (vertical !== this.directions.STRAIGHT && horizontal !== this.directions.STRAIGHT) {
      const pitchMagnitude = Math.abs(normalizedPitch);
      const yawMagnitude = Math.abs(normalizedYaw);
      
      // Compare magnitudes to determine primary direction
      if (pitchMagnitude > yawMagnitude * 1.5) {
        return vertical;
      } else if (yawMagnitude > pitchMagnitude * 1.5) {
        return horizontal;
      } else {
        // If both are similar, combine them (e.g., "up_left", "down_right")
        return `${vertical}_${horizontal}`;
      }
    }
    
    // Return the non-straight direction, or straight if both are straight
    return vertical !== this.directions.STRAIGHT ? vertical : horizontal;
  }

  /**
   * Specifically check if head is pointing down
   */
  checkHeadDown(pitch) {
    const normalizedPitch = this.normalizeAngle(pitch);
    return normalizedPitch > this.thresholds.pitchDown;
  }

  /**
   * Update head-down state with timing
   */
  updateHeadDownState(isHeadDown) {
    const now = Date.now();
    
    if (isHeadDown) {
      if (!this.isHeadDownActive) {
        this.isHeadDownActive = true;
        this.headDownStartTime = now;
      }
      this.headDownDuration = (now - this.headDownStartTime) / 1000; // in seconds
    } else {
      if (this.isHeadDownActive) {
        this.isHeadDownActive = false;
        this.headDownStartTime = null;
        this.headDownDuration = 0;
      }
    }
  }

  /**
   * Check for violations (head down + objects)
   */
  checkViolations(direction, isHeadDown) {
    const violations = [];
    
    // Check if head is down and objects are detected
    if (isHeadDown) {
      if (this.phoneDetected) {
        violations.push({
          type: 'phone_detection_with_head_down',
          severity: 'high',
          details: 'Phone detected while looking down',
          timestamp: new Date().toISOString(),
          headDirection: direction,
          duration: this.headDownDuration
        });
      }
      
      if (this.booksDetected) {
        violations.push({
          type: 'books_detection_with_head_down',
          severity: 'medium',
          details: 'Books detected while looking down',
          timestamp: new Date().toISOString(),
          headDirection: direction,
          duration: this.headDownDuration
        });
      }
      
      if (this.earphonesDetected) {
        violations.push({
          type: 'earphones_detection_with_head_down',
          severity: 'medium',
          details: 'Earphones detected while looking down',
          timestamp: new Date().toISOString(),
          headDirection: direction,
          duration: this.headDownDuration
        });
      }
    }
    
    // Check for prolonged head-down (more than 10 seconds)
    if (this.isHeadDownActive && this.headDownDuration > 10) {
      violations.push({
        type: 'prolonged_head_down',
        severity: 'medium',
        details: `Head down for ${Math.round(this.headDownDuration)} seconds`,
        timestamp: new Date().toISOString(),
        duration: this.headDownDuration
      });
    }
    
    // Check for excessive head movement
    if (this.headMovementHistory.length >= 10) {
      const recentMovements = this.headMovementHistory.slice(-10);
      const differentDirections = new Set(recentMovements.map(m => m.direction));
      const totalMovements = recentMovements.length;
      
      // If more than 50% of movements are not straight, it's excessive
      const nonStraightMovements = recentMovements.filter(m => m.direction !== this.directions.STRAIGHT);
      
      if (nonStraightMovements.length > totalMovements * 0.5) {
        violations.push({
          type: 'excessive_head_movement',
          severity: 'low',
          details: `Frequent head direction changes (${nonStraightMovements.length} in last ${totalMovements} frames)`,
          timestamp: new Date().toISOString(),
          directions: [...differentDirections]
        });
      }
    }
    
    return violations;
  }

  /**
   * Detect suspicious movement patterns
   */
  detectSuspiciousPatterns() {
    const patterns = [];
    
    if (this.headMovementHistory.length < 5) return patterns;
    
    const recent = this.headMovementHistory.slice(-5);
    
    // Pattern 1: Looking at phone (down + left/right)
    const lookingDown = recent.filter(m => m.isHeadDown);
    if (lookingDown.length >= 3 && this.phoneDetected) {
      patterns.push({
        type: 'looking_at_phone',
        severity: 'high',
        description: 'User appears to be looking at a phone (head down with phone detected)',
        confidence: Math.min(lookingDown.length / 5, 1)
      });
    }
    
    // Pattern 2: Cheating (rapid left/right movements)
    const sideMovements = recent.filter(m => 
      m.direction === this.directions.LEFT || 
      m.direction === this.directions.RIGHT
    );
    if (sideMovements.length >= 3) {
      patterns.push({
        type: 'rapid_side_movements',
        severity: 'medium',
        description: 'Rapid side-to-side head movements detected (potential cheating)',
        confidence: Math.min(sideMovements.length / 5, 1)
      });
    }
    
    // Pattern 3: Looking at notes (down with books detected)
    const downWithBooks = recent.filter(m => m.isHeadDown && m.booksDetected);
    if (downWithBooks.length >= 2) {
      patterns.push({
        type: 'looking_at_notes',
        severity: 'medium',
        description: 'User appears to be looking at notes/books',
        confidence: Math.min(downWithBooks.length / 5, 1)
      });
    }
    
    // Pattern 4: Looking at second device (down with earphones)
    const downWithEarphones = recent.filter(m => m.isHeadDown && m.earphonesDetected);
    if (downWithEarphones.length >= 2) {
      patterns.push({
        type: 'looking_at_second_device',
        severity: 'medium',
        description: 'User appears to be looking at a second device (earphones detected)',
        confidence: Math.min(downWithEarphones.length / 5, 1)
      });
    }
    
    return patterns;
  }

  /**
   * Normalize angle to range [-180, 180]
   */
  normalizeAngle(angle) {
    if (typeof angle !== 'number' || isNaN(angle)) return 0;
    
    let normalized = angle % 360;
    if (normalized > 180) normalized -= 360;
    if (normalized < -180) normalized += 360;
    return normalized;
  }

  /**
   * Get current status summary
   */
  getStatus() {
    return {
      currentDirection: this.currentDirection,
      previousDirection: this.previousDirection,
      isHeadDown: this.isHeadDown,
      isHeadDownActive: this.isHeadDownActive,
      headDownDuration: this.headDownDuration,
      phoneDetected: this.phoneDetected,
      booksDetected: this.booksDetected,
      earphonesDetected: this.earphonesDetected,
      faceDetected: this.faceDetected,
      movementHistory: this.headMovementHistory.slice(-5),
      suspiciousPatterns: this.suspiciousPatterns
    };
  }

  /**
   * Reset head-down state
   */
  resetHeadDownState() {
    this.isHeadDownActive = false;
    this.headDownStartTime = null;
    this.headDownDuration = 0;
  }
}

// ==========================================
// ===== TEMP AUTH MIDDLEWARE =====
// ==========================================

const fakeAuth = (req, res, next) => {
  req.user = { id: "demoUser123" };
  next();
};

// ==========================================
// ===== DEVICE DETECTION MIDDLEWARE =====
// ==========================================

const detectDevice = (req, res, next) => {
  const userAgent = req.headers['user-agent'] || '';
  
  // Detect mobile devices
  const isPhone = /Android|iPhone|iPod|BlackBerry|Windows Phone|Opera Mini|IEMobile/i.test(userAgent);
  const isTablet = /iPad|Tablet|PlayBook/i.test(userAgent);
  
  // Detect device type
  let deviceType = 'desktop';
  if (isPhone) deviceType = 'phone';
  else if (isTablet) deviceType = 'tablet';
  
  // Get screen info from request body (sent from frontend)
  const { screenResolution, deviceInfo: bodyDeviceInfo } = req.body;
  
  req.deviceInfo = {
    isPhone: isPhone,
    isTablet: isTablet,
    deviceType: deviceType,
    userAgent: userAgent,
    screenResolution: screenResolution || bodyDeviceInfo?.screenResolution || 'unknown',
    timestamp: new Date().toISOString(),
    ip: req.ip || req.connection.remoteAddress
  };
  
  next();
};

// ==========================================
// ===== HEAD MOVEMENT MIDDLEWARE =====
// ==========================================

const headMovementMiddleware = (req, res, next) => {
  // Initialize head movement detector if not exists
  if (!req.headMovementDetector) {
    req.headMovementDetector = new HeadMovementDetector();
  }
  
  // Get head pose data from request
  const headPose = {
    pitch: parseFloat(req.body.headPitch || req.query.headPitch || req.headers['x-head-pitch'] || 0),
    yaw: parseFloat(req.body.headYaw || req.query.headYaw || req.headers['x-head-yaw'] || 0),
    roll: parseFloat(req.body.headRoll || req.query.headRoll || req.headers['x-head-roll'] || 0)
  };
  
  // Get detection results
  const detectionResults = {
    phone: req.body.phoneDetected === true || req.body.phoneDetected === 'true' || 
           req.headers['x-phone-detected'] === 'true' || false,
    books: req.body.booksDetected === true || req.body.booksDetected === 'true' ||
           req.headers['x-books-detected'] === 'true' || false,
    earphones: req.body.earphonesDetected === true || req.body.earphonesDetected === 'true' ||
               req.headers['x-earphones-detected'] === 'true' || false,
    face: req.body.faceDetected === true || req.body.faceDetected === 'true' ||
          req.headers['x-face-detected'] === 'true' || true
  };
  
  // Process head movement
  const result = req.headMovementDetector.processHeadPose(headPose, detectionResults);
  
  // Attach to request
  req.headMovement = result;
  req.isHeadDown = result.isHeadDown;
  req.headDirection = result.direction;
  req.headDownDuration = result.headDownDuration;
  req.isHeadDownActive = result.isHeadDownActive;
  req.phoneDetected = result.phoneDetected;
  req.booksDetected = result.booksDetected;
  req.earphonesDetected = result.earphonesDetected;
  
  // Check for active violations
  if (result.violations.length > 0) {
    req.activeViolations = result.violations;
    console.log(`🚨 Active violations detected: ${result.violations.length}`);
  }
  
  next();
};

// ==========================================
// ===== PHONE DETECTION MIDDLEWARE =====
// ==========================================

const phoneDetectionMiddleware = (req, res, next) => {
  const validator = getDeviceValidator();
  
  // Initialize phone detection if not already
  if (!validator.phoneDetector) {
    validator.phoneDetector = new PhoneDetection();
    validator.phoneDetector.init(req.deviceInfo, {
      type: 'secondary_device',
      status: 'monitoring'
    });
    validator.isDetectionActive = true;
  }
  
  req.phoneDetector = validator.phoneDetector;
  next();
};

// ==========================================
// ===== DEBUG CHECK =====
// ==========================================

if (!proctoringController) {
  throw new Error("❌ proctoringController not imported properly");
}

// ==========================================
// ===== HEAD MOVEMENT DETECTION ROUTES =====
// ==========================================

/**
 * Update head movement data (real-time)
 */
router.post(
  '/head-movement',
  fakeAuth,
  detectDevice,
  headMovementMiddleware,
  phoneDetectionMiddleware,
  async (req, res) => {
    try {
      const { examId, userId } = req.body;
      const validator = getDeviceValidator();
      
      // Get head movement result
      const headMovement = req.headMovement;
      
      // Log suspicious activities
      if (headMovement.violations.length > 0) {
        for (const violation of headMovement.violations) {
          // Save to database via controller
          if (proctoringController.saveViolation) {
            await proctoringController.saveViolation({
              examId: examId || 'default-exam',
              userId: userId || req.user.id,
              type: violation.type,
              severity: violation.severity,
              details: {
                ...violation.details,
                headDirection: headMovement.direction,
                isHeadDown: headMovement.isHeadDown,
                phoneDetected: headMovement.phoneDetected,
                booksDetected: headMovement.booksDetected,
                earphonesDetected: headMovement.earphonesDetected,
                deviceInfo: req.deviceInfo
              },
              timestamp: violation.timestamp
            });
          }
          
          // Add to in-memory list
          if (validator.phoneDetector) {
            validator.phoneDetector.addSuspiciousActivity(violation);
          }
        }
      }
      
      // Return head movement data
      res.status(200).json({
        success: true,
        headMovement: {
          direction: headMovement.direction,
          previousDirection: headMovement.previousDirection,
          isHeadDown: headMovement.isHeadDown,
          isHeadDownActive: headMovement.isHeadDownActive,
          headDownDuration: headMovement.headDownDuration,
          phoneDetected: headMovement.phoneDetected,
          booksDetected: headMovement.booksDetected,
          earphonesDetected: headMovement.earphonesDetected,
          faceDetected: headMovement.faceDetected,
          violations: headMovement.violations,
          patterns: headMovement.patterns,
          movementHistory: headMovement.history
        },
        deviceType: req.deviceInfo.deviceType,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error processing head movement:", error);
      res.status(500).json({
        success: false,
        error: "Failed to process head movement data"
      });
    }
  }
);

/**
 * Start head-down detection with enhanced tracking
 */
router.post(
  '/start-detection',
  fakeAuth,
  detectDevice,
  phoneDetectionMiddleware,
  async (req, res) => {
    try {
      const { examId, userId, enableHeadTracking = true } = req.body;
      const validator = getDeviceValidator();
      
      // Initialize head movement detector
      const headDetector = new HeadMovementDetector();
      
      // Start detection
      const detectionResult = validator.phoneDetector.init(
        req.deviceInfo,
        { 
          type: 'mobile', 
          status: 'connected',
          headTracking: enableHeadTracking
        }
      );
      
      // Save to database via controller
      if (proctoringController.startProctoring) {
        const session = await proctoringController.startProctoring({
          examId: examId || 'default-exam',
          userId: userId || req.user.id,
          deviceInfo: req.deviceInfo,
          headTrackingEnabled: enableHeadTracking
        });
        
        res.status(200).json({
          success: true,
          message: "Head-down detection started with enhanced tracking",
          detectionResult: detectionResult,
          sessionId: session?._id,
          deviceType: req.deviceInfo.deviceType,
          isPhoneDetected: req.deviceInfo.isPhone,
          headTrackingEnabled: enableHeadTracking,
          directions: ['straight', 'up', 'down', 'left', 'right']
        });
      } else {
        // Fallback: just log
        console.log('Head-down detection started for exam:', examId);
        res.status(200).json({
          success: true,
          message: "Head-down detection started (fallback mode)",
          detectionResult: detectionResult,
          directions: ['straight', 'up', 'down', 'left', 'right']
        });
      }
    } catch (error) {
      console.error("Error starting detection:", error);
      res.status(500).json({
        success: false,
        error: "Failed to start head-down detection"
      });
    }
  }
);

/**
 * Get current head movement and detection status
 */
router.get(
  '/detection-status/:sessionId?',
  fakeAuth,
  phoneDetectionMiddleware,
  headMovementMiddleware,
  async (req, res) => {
    try {
      const validator = getDeviceValidator();
      const status = validator.phoneDetector?.getStatus() || {};
      const headStatus = req.headMovementDetector?.getStatus() || {};
      
      // Get suspicious activities
      const activities = validator.phoneDetector?.getSuspiciousActivities() || [];
      
      res.status(200).json({
        success: true,
        sessionId: req.params.sessionId || 'active',
        status: {
          // Head movement status
          headDirection: headStatus.currentDirection || 'straight',
          previousHeadDirection: headStatus.previousDirection || 'straight',
          isHeadDown: headStatus.isHeadDown || false,
          isHeadDownActive: headStatus.isHeadDownActive || false,
          headDownDuration: headStatus.headDownDuration || 0,
          
          // Object detection
          phoneDetected: headStatus.phoneDetected || status.phoneDetected || false,
          earphonesDetected: headStatus.earphonesDetected || status.earphonesDetected || false,
          booksDetected: headStatus.booksDetected || status.booksDetected || false,
          faceDetected: headStatus.faceDetected || true,
          
          // Detection status
          detectionActive: status.detectionActive || false,
          suspiciousActivitiesCount: activities.length,
          
          // Recent movements (last 5)
          recentMovements: headStatus.movementHistory || [],
          
          // Suspicious patterns
          patterns: headStatus.suspiciousPatterns || [],
          
          // Last activity
          lastActivity: activities[activities.length - 1] || null
        },
        deviceInfo: validator.deviceInfo,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error getting detection status:", error);
      res.status(500).json({
        success: false,
        error: "Failed to get detection status"
      });
    }
  }
);

/**
 * Get suspicious activities (with filtering)
 */
router.get(
  '/suspicious-activities/:examId?',
  fakeAuth,
  phoneDetectionMiddleware,
  async (req, res) => {
    try {
      const { examId } = req.params;
      const { limit = 50, type, severity, headDirection } = req.query;
      
      const validator = getDeviceValidator();
      let activities = validator.phoneDetector?.getSuspiciousActivities() || [];
      
      // Filter by exam ID if provided and controller supports it
      if (examId && proctoringController.getSuspiciousActivities) {
        const dbActivities = await proctoringController.getSuspiciousActivities(
          examId,
          { limit: parseInt(limit), type, severity, headDirection }
        );
        activities = [...activities, ...dbActivities];
      }
      
      // Filter by type
      if (type) {
        activities = activities.filter(a => a.type === type);
      }
      
      // Filter by head direction
      if (headDirection) {
        activities = activities.filter(a => 
          a.details?.headDirection === headDirection ||
          a.headDirection === headDirection
        );
      }
      
      // Sort by timestamp (newest first)
      activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      // Limit results
      activities = activities.slice(0, parseInt(limit));
      
      res.status(200).json({
        success: true,
        examId: examId || 'all',
        activities: activities,
        count: activities.length,
        totalSuspicious: validator.phoneDetector?.suspiciousActivities?.length || 0,
        availableHeadDirections: ['straight', 'up', 'down', 'left', 'right']
      });
    } catch (error) {
      console.error("Error fetching suspicious activities:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch suspicious activities"
      });
    }
  }
);

/**
 * Stop head-down detection
 */
router.post(
  '/stop-detection',
  fakeAuth,
  phoneDetectionMiddleware,
  async (req, res) => {
    try {
      const validator = getDeviceValidator();
      
      if (validator.phoneDetector) {
        validator.phoneDetector.stop();
        validator.isDetectionActive = false;
      }
      
      // Reset head movement detector
      if (req.headMovementDetector) {
        req.headMovementDetector.resetHeadDownState();
      }
      
      res.status(200).json({
        success: true,
        message: "Head-down detection stopped",
        stoppedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error stopping detection:", error);
      res.status(500).json({
        success: false,
        error: "Failed to stop detection"
      });
    }
  }
);

/**
 * Report a violation with head movement context
 */
router.post(
  '/report-violation',
  fakeAuth,
  detectDevice,
  phoneDetectionMiddleware,
  headMovementMiddleware,
  async (req, res) => {
    try {
      const { examId, userId, type, severity, details } = req.body;
      
      const validator = getDeviceValidator();
      const headMovement = req.headMovement;
      
      // Log the violation with head movement context
      const violationData = {
        examId: examId || 'default-exam',
        userId: userId || req.user.id,
        type: type || 'phone_detection',
        severity: severity || 'medium',
        details: {
          ...details,
          deviceInfo: req.deviceInfo,
          headDirection: headMovement.direction || 'straight',
          isHeadDown: headMovement.isHeadDown || false,
          headDownDuration: headMovement.headDownDuration || 0,
          phoneDetected: headMovement.phoneDetected || false,
          earphonesDetected: headMovement.earphonesDetected || false,
          booksDetected: headMovement.booksDetected || false,
          faceDetected: headMovement.faceDetected || true
        },
        timestamp: new Date().toISOString(),
        headMovementHistory: headMovement.history?.slice(-5) || []
      };
      
      // Save via controller
      if (proctoringController.saveViolation) {
        await proctoringController.saveViolation(violationData);
      } else if (proctoringController.saveProctoringLog) {
        await proctoringController.saveProctoringLog(violationData);
      }
      
      // Also add to in-memory list
      if (validator.phoneDetector) {
        validator.phoneDetector.addSuspiciousActivity(violationData);
      }
      
      console.log(`🚨 Proctoring Violation Reported: ${type} (Head: ${headMovement.direction})`);
      
      res.status(200).json({
        success: true,
        message: "Violation reported successfully",
        violation: violationData,
        headDirection: headMovement.direction
      });
    } catch (error) {
      console.error("Error reporting violation:", error);
      res.status(500).json({
        success: false,
        error: "Failed to report violation"
      });
    }
  }
);

// ==========================================
// ===== EXISTING DEVICE ROUTES (Updated) =====
// ==========================================

/**
 * Log device information with head movement detection integration
 */
router.post(
  '/log-device',
  fakeAuth,
  detectDevice,
  phoneDetectionMiddleware,
  headMovementMiddleware,
  async (req, res) => {
    try {
      const { deviceInfo, page, timestamp, enableDetection = false } = req.body;
      const validator = getDeviceValidator();
      
      const userDeviceInfo = {
        ...req.deviceInfo,
        ...deviceInfo,
        page: page || 'unknown',
        clientTimestamp: timestamp || new Date().toISOString(),
        userId: req.user.id,
        detectionActive: enableDetection ? validator.isDetectionActive : false,
        headMovement: req.headMovement || null
      };
      
      console.log(`📱 Device logged: ${userDeviceInfo.deviceType} | Head: ${req.headMovement?.direction || 'unknown'}`);
      
      // Start detection if enabled
      if (enableDetection && !validator.phoneDetector) {
        validator.phoneDetector = new PhoneDetection();
        validator.phoneDetector.init(req.deviceInfo, {
          type: 'secondary_device',
          status: 'monitoring'
        });
        validator.isDetectionActive = true;
        console.log('🔍 Phone detection started automatically');
      }
      
      // Save to database if controller method exists
      if (proctoringController.saveDeviceLog) {
        await proctoringController.saveDeviceLog(userDeviceInfo);
      }
      
      res.status(200).json({ 
        success: true, 
        message: "Device info logged successfully",
        deviceType: req.deviceInfo.deviceType,
        detectionStatus: validator.isDetectionActive ? 'active' : 'inactive',
        headDirection: req.headMovement?.direction || 'unknown'
      });
    } catch (error) {
      console.error("Error logging device:", error);
      res.status(500).json({ 
        success: false, 
        error: "Failed to log device info" 
      });
    }
  }
);

/**
 * Proctoring violation route (enhanced with head movement)
 */
router.post(
  '/violation',
  fakeAuth,
  detectDevice,
  phoneDetectionMiddleware,
  headMovementMiddleware,
  async (req, res) => {
    try {
      const { type, details, timestamp, examId } = req.body;
      const validator = getDeviceValidator();
      const headMovement = req.headMovement;
      
      // Check if it's a head-down violation
      const isHeadDownViolation = type === 'head_down' || 
                                 type === 'phone_detection' ||
                                 type === 'books_detection' ||
                                 (details?.headDown && details?.phoneDetected);
      
      const violation = {
        type: type || 'unknown',
        details: {
          ...details,
          deviceInfo: req.deviceInfo,
          headDirection: headMovement?.direction || 'straight',
          headDown: headMovement?.isHeadDown || false,
          headDownDuration: headMovement?.headDownDuration || 0,
          phoneDetected: headMovement?.phoneDetected || details?.phoneDetected || false,
          earphonesDetected: headMovement?.earphonesDetected || details?.earphonesDetected || false,
          booksDetected: headMovement?.booksDetected || details?.booksDetected || false,
          faceDetected: headMovement?.faceDetected !== undefined ? headMovement.faceDetected : true
        },
        timestamp: timestamp || new Date().toISOString(),
        examId: examId || req.params.examId,
        userId: req.user.id,
        deviceInfo: req.deviceInfo,
        ip: req.ip || req.connection.remoteAddress,
        isHeadDownViolation: isHeadDownViolation,
        headMovementHistory: headMovement?.history?.slice(-3) || []
      };
      
      console.log(`🚨 Proctoring Violation: ${type} (Head: ${headMovement?.direction || 'unknown'})`);
      
      // Add to phone detector's suspicious activities
      if (validator.phoneDetector && isHeadDownViolation) {
        validator.phoneDetector.addSuspiciousActivity({
          type: type || 'phone_detection',
          timestamp: violation.timestamp,
          details: violation.details
        });
      }
      
      // Save violation to database
      if (proctoringController.saveViolation) {
        await proctoringController.saveViolation(violation);
      } else if (proctoringController.saveProctoringLog) {
        await proctoringController.saveProctoringLog({
          examId: examId,
          violations: [violation],
          userId: req.user.id
        });
      }
      
      res.status(200).json({ 
        success: true, 
        message: "Violation logged successfully",
        isHeadDownViolation: isHeadDownViolation,
        headDirection: headMovement?.direction || 'straight'
      });
    } catch (error) {
      console.error("Error logging violation:", error);
      res.status(500).json({ 
        success: false, 
        error: "Failed to log violation" 
      });
    }
  }
);

/**
 * Exam start attempt with head-down detection preparation
 */
router.post(
  '/exam/start-attempt',
  fakeAuth,
  detectDevice,
  phoneDetectionMiddleware,
  headMovementMiddleware,
  async (req, res) => {
    try {
      const { deviceInfo, timestamp, examId, enableProctoring = true } = req.body;
      const validator = getDeviceValidator();
      
      const examAttempt = {
        deviceInfo: { ...req.deviceInfo, ...deviceInfo },
        timestamp: timestamp || new Date().toISOString(),
        examId: examId,
        userId: req.user.id,
        status: 'attempted',
        ip: req.ip || req.connection.remoteAddress,
        proctoringEnabled: enableProctoring,
        headMovement: req.headMovement || null
      };
      
      console.log(`📝 Exam start attempt: ${examId} | Head: ${req.headMovement?.direction || 'unknown'}`);
      
      // Initialize phone detection for proctoring
      if (enableProctoring && !validator.phoneDetector) {
        validator.phoneDetector = new PhoneDetection();
        validator.phoneDetector.init(req.deviceInfo, {
          type: 'secondary_device',
          status: 'proctoring_active'
        });
        validator.isDetectionActive = true;
        console.log('🔍 Proctoring detection initialized for exam:', examId);
      }
      
      // Save exam attempt to database
      if (proctoringController.saveExamAttempt) {
        await proctoringController.saveExamAttempt(examAttempt);
      } else if (proctoringController.saveExamSession) {
        await proctoringController.saveExamSession(examId, {
          ...examAttempt,
          sessionData: { startAttempt: examAttempt }
        });
      }
      
      // Check if device is allowed
      const isBlocked = req.deviceInfo.isPhone;
      
      res.status(200).json({ 
        success: true, 
        allowed: !isBlocked,
        message: isBlocked ? "Mobile devices not allowed" : "Exam attempt logged",
        deviceType: req.deviceInfo.deviceType,
        proctoringStatus: validator.isDetectionActive ? 'active' : 'inactive',
        headDirection: req.headMovement?.direction || 'straight'
      });
    } catch (error) {
      console.error("Error logging exam attempt:", error);
      res.status(500).json({ 
        success: false, 
        error: "Failed to log exam attempt" 
      });
    }
  }
);

/**
 * Device check route (enhanced with head movement)
 */
router.get(
  '/device-check',
  fakeAuth,
  detectDevice,
  phoneDetectionMiddleware,
  headMovementMiddleware,
  async (req, res) => {
    try {
      const isAllowed = !req.deviceInfo.isPhone;
      const validator = getDeviceValidator();
      
      res.status(200).json({
        success: true,
        allowed: isAllowed,
        deviceType: req.deviceInfo.deviceType,
        isPhone: req.deviceInfo.isPhone,
        isTablet: req.deviceInfo.isTablet,
        message: isAllowed ? "Device allowed for exam" : "Mobile devices not allowed for proctored exams",
        requirements: {
          webcam: true,
          microphone: true,
          desktopRequired: req.deviceInfo.isPhone,
          proctoringSupported: true,
          headTrackingSupported: true
        },
        detectionStatus: validator.isDetectionActive ? 'active' : 'inactive',
        headDirection: req.headMovement?.direction || 'straight',
        supportedDirections: ['straight', 'up', 'down', 'left', 'right']
      });
    } catch (error) {
      console.error("Error checking device:", error);
      res.status(500).json({ 
        success: false, 
        error: "Failed to check device" 
      });
    }
  }
);

/**
 * Get device logs with detection data
 */
router.get(
  '/device-logs/:userId?',
  fakeAuth,
  async (req, res) => {
    try {
      const userId = req.params.userId || req.user.id;
      
      let deviceLogs = [];
      
      // Get device logs from database
      if (proctoringController.getDeviceLogs) {
        deviceLogs = await proctoringController.getDeviceLogs(userId);
      }
      
      // Get detection status
      const validator = getDeviceValidator();
      const detectionStatus = validator.isDetectionActive ? 'active' : 'inactive';
      const suspiciousCount = validator.phoneDetector?.suspiciousActivities?.length || 0;
      
      res.status(200).json({
        success: true,
        logs: deviceLogs,
        count: deviceLogs.length,
        detectionStatus: detectionStatus,
        suspiciousActivitiesCount: suspiciousCount
      });
    } catch (error) {
      console.error("Error fetching device logs:", error);
      res.status(500).json({ 
        success: false, 
        error: "Failed to fetch device logs" 
      });
    }
  }
);

// ==========================================
// ===== EXISTING ROUTES (Keep as is) =====
// ==========================================

// Save proctoring log
router.post(
  '/log/:examId',
  fakeAuth,
  detectDevice,
  phoneDetectionMiddleware,
  headMovementMiddleware,
  async (req, res) => {
    try {
      const { examId } = req.params;
      const logData = {
        ...req.body,
        examId,
        userId: req.user.id,
        deviceInfo: req.deviceInfo,
        timestamp: new Date().toISOString(),
        hasDetection: !!req.phoneDetector,
        headMovement: req.headMovement || null
      };
      
      if (proctoringController.saveProctoringLog) {
        await proctoringController.saveProctoringLog(logData);
        res.status(200).json({ 
          success: true, 
          message: "Proctoring log saved",
          headDirection: req.headMovement?.direction || 'unknown'
        });
      } else {
        res.status(500).json({ error: "saveProctoringLog not defined" });
      }
    } catch (error) {
      console.error("Error saving proctoring log:", error);
      res.status(500).json({ error: "Failed to save proctoring log" });
    }
  }
);

// Get all logs with detection data
router.get(
  '/logs/:examId',
  fakeAuth,
  async (req, res) => {
    try {
      const { examId } = req.params;
      
      let logs = [];
      if (proctoringController.getProctoringLogs) {
        logs = await proctoringController.getProctoringLogs(examId);
      }
      
      // Add detection data if available
      const validator = getDeviceValidator();
      const detectionData = validator.phoneDetector?.getStatus() || {};
      
      res.status(200).json({ 
        success: true, 
        logs,
        detectionData: {
          headDownDetected: detectionData.isHeadDown || false,
          phoneDetected: detectionData.phoneDetected || false,
          headDirection: detectionData.headDirection || 'straight',
          suspiciousActivities: validator.phoneDetector?.suspiciousActivities?.length || 0
        }
      });
    } catch (error) {
      console.error("Error fetching logs:", error);
      res.status(500).json({ error: "Failed to fetch logs" });
    }
  }
);

// Generate report with detection data
router.get(
  '/report/:examId',
  fakeAuth,
  async (req, res) => {
    try {
      const { examId } = req.params;
      
      let report = {};
      if (proctoringController.generateReport) {
        report = await proctoringController.generateReport(examId);
      }
      
      // Add detection summary
      const validator = getDeviceValidator();
      const detectionData = validator.phoneDetector?.getStatus() || {};
      const activities = validator.phoneDetector?.getSuspiciousActivities() || [];
      
      // Analyze head movement patterns
      const headDownEvents = activities.filter(a => 
        a.type === 'head_down' || 
        a.type === 'phone_detection_with_head_down' ||
        a.type === 'prolonged_head_down'
      );
      
      const sideMovements = activities.filter(a => 
        a.details?.headDirection === 'left' || 
        a.details?.headDirection === 'right'
      );
      
      report.detectionSummary = {
        headDownEvents: headDownEvents.length,
        sideMovementEvents: sideMovements.length,
        phoneDetectionEvents: activities.filter(a => a.type === 'phone_detection').length,
        totalSuspiciousEvents: activities.length,
        currentStatus: detectionData,
        headMovementDistribution: {
          straight: activities.filter(a => a.details?.headDirection === 'straight').length,
          up: activities.filter(a => a.details?.headDirection === 'up').length,
          down: activities.filter(a => a.details?.headDirection === 'down').length,
          left: activities.filter(a => a.details?.headDirection === 'left').length,
          right: activities.filter(a => a.details?.headDirection === 'right').length
        }
      };
      
      res.status(200).json({ success: true, report });
    } catch (error) {
      console.error("Error generating report:", error);
      res.status(500).json({ error: "Failed to generate report" });
    }
  }
);

// Save exam session with detection
router.post(
  '/session/:examId',
  fakeAuth,
  detectDevice,
  phoneDetectionMiddleware,
  headMovementMiddleware,
  async (req, res) => {
    try {
      const { examId } = req.params;
      const validator = getDeviceValidator();
      
      const sessionData = {
        ...req.body,
        examId,
        userId: req.user.id,
        deviceInfo: req.deviceInfo,
        timestamp: new Date().toISOString(),
        detectionActive: validator.isDetectionActive,
        detectionStatus: validator.phoneDetector?.getStatus() || {},
        headMovement: req.headMovement || null,
        headDirection: req.headMovement?.direction || 'straight'
      };
      
      if (proctoringController.saveExamSession) {
        await proctoringController.saveExamSession(examId, sessionData);
        res.status(200).json({ 
          success: true, 
          message: "Exam session saved",
          detectionActive: validator.isDetectionActive,
          headDirection: req.headMovement?.direction || 'straight'
        });
      } else {
        res.status(500).json({ error: "saveExamSession not defined" });
      }
    } catch (error) {
      console.error("Error saving exam session:", error);
      res.status(500).json({ error: "Failed to save exam session" });
    }
  }
);

// Get exam session with detection data
router.get(
  '/session/:examId',
  fakeAuth,
  async (req, res) => {
    try {
      const { examId } = req.params;
      
      let session = {};
      if (proctoringController.getExamSession) {
        session = await proctoringController.getExamSession(examId);
      }
      
      // Add detection data
      const validator = getDeviceValidator();
      session.detectionData = validator.phoneDetector?.getStatus() || {};
      session.suspiciousCount = validator.phoneDetector?.suspiciousActivities?.length || 0;
      
      res.status(200).json({ success: true, session });
    } catch (error) {
      console.error("Error fetching exam session:", error);
      res.status(500).json({ error: "Failed to fetch exam session" });
    }
  }
);

// ==========================================
// ===== REAL-TIME WEBSOCKET ROUTE =====
// ==========================================

/**
 * Webhook for real-time detection events
 */
router.post(
  '/webhook/detection',
  fakeAuth,
  detectDevice,
  headMovementMiddleware,
  async (req, res) => {
    try {
      const { event, data, examId, userId } = req.body;
      
      const validator = getDeviceValidator();
      const headMovement = req.headMovement;
      
      // Process detection event
      if (event === 'head_down') {
        console.log(`🔴 Head-down detected (${headMovement?.direction || 'unknown'}):`, data);
        
        if (data.phoneDetected) {
          // Log violation
          await proctoringController.saveViolation?.({
            examId: examId || 'default-exam',
            userId: userId || req.user.id,
            type: 'phone_detection_with_head_down',
            severity: 'high',
            details: {
              headDown: true,
              headDirection: headMovement?.direction || 'straight',
              phoneDetected: true,
              ...data,
              headMovementHistory: headMovement?.history?.slice(-3) || []
            }
          });
          
          // Add to in-memory list
          validator.phoneDetector?.addSuspiciousActivity({
            type: 'phone_detection_with_head_down',
            timestamp: new Date().toISOString(),
            details: {
              ...data,
              headDirection: headMovement?.direction || 'straight'
            }
          });
        }
      }
      
      // Handle head direction change
      if (event === 'head_direction_change') {
        console.log(`🔄 Head direction changed to: ${headMovement?.direction || 'unknown'}`);
        // Log direction change if needed
      }
      
      res.status(200).json({
        success: true,
        message: 'Webhook processed',
        event: event,
        headDirection: headMovement?.direction || 'unknown'
      });
    } catch (error) {
      console.error('Webhook error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// ==========================================
// ===== TEST ROUTE =====
// ==========================================

router.get('/', (req, res) => {
  res.json({ 
    message: "Proctoring Routes Working ✅ (with Enhanced Head Movement Detection)",
    endpoints: {
      headMovement: "POST /api/proctoring/head-movement",
      startDetection: "POST /api/proctoring/start-detection",
      detectionStatus: "GET /api/proctoring/detection-status/:sessionId?",
      suspiciousActivities: "GET /api/proctoring/suspicious-activities/:examId?",
      stopDetection: "POST /api/proctoring/stop-detection",
      reportViolation: "POST /api/proctoring/report-violation",
      deviceLog: "POST /api/proctoring/log-device",
      violation: "POST /api/proctoring/violation",
      examAttempt: "POST /api/proctoring/exam/start-attempt",
      deviceCheck: "GET /api/proctoring/device-check",
      deviceLogs: "GET /api/proctoring/device-logs/:userId?",
      webhook: "POST /api/proctoring/webhook/detection"
    },
    detectionFeatures: {
      headDirections: ['straight', 'up', 'down', 'left', 'right'],
      headDownDetection: true,
      phoneDetection: true,
      earphonesDetection: true,
      booksDetection: true,
      screenshotCapture: true,
      realTimeMonitoring: true,
      patternDetection: true,
      movementHistory: true
    },
    thresholds: {
      pitchUp: -12,
      pitchDown: 12,
      yawLeft: -15,
      yawRight: 15
    }
  });
});

module.exports = router;        