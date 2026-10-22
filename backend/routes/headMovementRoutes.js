// backend/routes/headMovementRoutes.js
import express from 'express';
const router = express.Router();

// Import middleware
import { protect } from '../middleware/authMiddleware.js';
import { processHeadMovement, getHeadMovementStatus } from '../middleware/headMovementMiddleware.js';

/**
 * Update head movement data (real-time)
 * POST /api/head-movement/update
 */
router.post(
    '/update',
    protect,
    processHeadMovement,
    async (req, res) => {
        try {
            const result = req.headMovement;
            
            // Check for violations and log them
            if (result.violations && result.violations.length > 0) {
                console.log(`🚨 Head Movement Violations for user ${req.user?.email || 'unknown'}:`);
                result.violations.forEach(v => {
                    console.log(`   - ${v.message} (${v.severity})`);
                });
                
                // You can save violations to database here
                // Example: await saveViolationToDatabase(req.user.id, result.violations);
            }
            
            res.json({
                success: true,
                headMovement: {
                    direction: result.direction,
                    previousDirection: result.previousDirection,
                    isHeadDown: result.isHeadDown,
                    pitch: result.pitch,
                    yaw: result.yaw,
                    phoneDetected: result.phoneDetected,
                    booksDetected: result.booksDetected,
                    earphonesDetected: result.earphonesDetected,
                    faceDetected: result.faceDetected,
                    violations: result.violations,
                    directionCounts: result.directionCounts,
                    recentHistory: result.history
                },
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error('Error updating head movement:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to update head movement data'
            });
        }
    }
);

/**
 * Get current head movement status
 * GET /api/head-movement/status
 */
router.get(
    '/status',
    protect,
    getHeadMovementStatus
);

/**
 * Get head movement history
 * GET /api/head-movement/history
 */
router.get(
    '/history',
    protect,
    async (req, res) => {
        try {
            if (!req.headMovementDetector) {
                return res.status(400).json({
                    success: false,
                    error: 'Head movement detector not initialized'
                });
            }
            
            const history = req.headMovementDetector.history || [];
            const violations = req.headMovementDetector.violations || [];
            const directionCounts = req.headMovementDetector.directionCounts || {
                straight: 0,
                up: 0,
                down: 0,
                left: 0,
                right: 0
            };
            
            // Get last 50 entries
            const recentHistory = history.slice(-50);
            
            // Get last 20 violations
            const recentViolations = violations.slice(-20);
            
            res.json({
                success: true,
                history: recentHistory,
                violations: recentViolations,
                totalMovements: history.length,
                totalViolations: violations.length,
                directionCounts: directionCounts,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error('Error fetching history:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch head movement history'
            });
        }
    }
);

/**
 * Get violation summary
 * GET /api/head-movement/violations
 */
router.get(
    '/violations',
    protect,
    async (req, res) => {
        try {
            if (!req.headMovementDetector) {
                return res.status(400).json({
                    success: false,
                    error: 'Head movement detector not initialized'
                });
            }
            
            const violations = req.headMovementDetector.violations || [];
            
            // Group violations by type
            const summary = {};
            violations.forEach(v => {
                if (!summary[v.type]) {
                    summary[v.type] = {
                        count: 0,
                        severity: v.severity,
                        lastOccurrence: v.timestamp,
                        details: []
                    };
                }
                summary[v.type].count++;
                summary[v.type].lastOccurrence = v.timestamp;
                summary[v.type].details.push(v);
            });
            
            res.json({
                success: true,
                summary: summary,
                totalViolations: violations.length,
                recentViolations: violations.slice(-10)
            });
        } catch (error) {
            console.error('Error fetching violations:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch violation summary'
            });
        }
    }
);

/**
 * Reset head movement data
 * POST /api/head-movement/reset
 */
router.post(
    '/reset',
    protect,
    async (req, res) => {
        try {
            if (req.headMovementDetector) {
                req.headMovementDetector.reset();
            }
            
            res.json({
                success: true,
                message: 'Head movement data reset successfully',
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error('Error resetting data:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to reset head movement data'
            });
        }
    }
);

/**
 * Report violation manually
 * POST /api/head-movement/report-violation
 */
router.post(
    '/report-violation',
    protect,
    async (req, res) => {
        try {
            const { type, severity, message, details } = req.body;
            
            if (!type || !message) {
                return res.status(400).json({
                    success: false,
                    error: 'Type and message are required'
                });
            }
            
            const violation = {
                type: type,
                severity: severity || 'medium',
                message: message,
                details: details || {},
                timestamp: new Date().toISOString(),
                reportedBy: req.user?.id || 'unknown'
            };
            
            // Add to detector if available
            if (req.headMovementDetector) {
                req.headMovementDetector.violations.push(violation);
                
                // Limit violations stored
                if (req.headMovementDetector.violations.length > 100) {
                    req.headMovementDetector.violations = 
                        req.headMovementDetector.violations.slice(-100);
                }
            }
            
            res.json({
                success: true,
                message: 'Violation reported successfully',
                violation: violation
            });
        } catch (error) {
            console.error('Error reporting violation:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to report violation'
            });
        }
    }
);

/**
 * Get direction statistics
 * GET /api/head-movement/statistics
 */
router.get(
    '/statistics',
    protect,
    async (req, res) => {
        try {
            if (!req.headMovementDetector) {
                return res.status(400).json({
                    success: false,
                    error: 'Head movement detector not initialized'
                });
            }
            
            const history = req.headMovementDetector.history || [];
            const directionCounts = req.headMovementDetector.directionCounts || {};
            const totalMovements = history.length;
            
            // Calculate percentages
            const percentages = {};
            const total = Object.values(directionCounts).reduce((a, b) => a + b, 0) || 1;
            
            Object.keys(directionCounts).forEach(key => {
                percentages[key] = ((directionCounts[key] / total) * 100).toFixed(1);
            });
            
            // Calculate average head down duration
            let headDownTotal = 0;
            let headDownCount = 0;
            let currentDuration = 0;
            let isCurrentlyDown = false;
            
            for (let i = 0; i < history.length; i++) {
                if (history[i].isHeadDown) {
                    if (!isCurrentlyDown) {
                        isCurrentlyDown = true;
                        currentDuration = 0;
                    }
                    currentDuration++;
                } else {
                    if (isCurrentlyDown) {
                        headDownTotal += currentDuration;
                        headDownCount++;
                        isCurrentlyDown = false;
                        currentDuration = 0;
                    }
                }
            }
            
            const avgHeadDownDuration = headDownCount > 0 
                ? (headDownTotal / headDownCount).toFixed(1) 
                : 0;
            
            res.json({
                success: true,
                statistics: {
                    totalMovements: totalMovements,
                    directionDistribution: directionCounts,
                    directionPercentages: percentages,
                    avgHeadDownDuration: `${avgHeadDownDuration} frames`,
                    totalHeadDownEvents: headDownCount,
                    currentHeadDirection: req.headMovementDetector.currentDirection,
                    isHeadDown: req.headMovementDetector.isHeadDown,
                    totalViolations: req.headMovementDetector.violations?.length || 0
                },
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error('Error fetching statistics:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch statistics'
            });
        }
    }
);

/**
 * Batch update for multiple frames
 * POST /api/head-movement/batch
 */
router.post(
    '/batch',
    protect,
    async (req, res) => {
        try {
            const { frames } = req.body;
            
            if (!frames || !Array.isArray(frames) || frames.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Frames array is required'
                });
            }
            
            const results = [];
            const allViolations = [];
            
            // Process each frame
            for (const frame of frames) {
                const { pitch, yaw, roll, phoneDetected, booksDetected, earphonesDetected } = frame;
                
                // Create a mock request object for processing
                const mockReq = {
                    headers: {
                        'x-head-pitch': pitch || 0,
                        'x-head-yaw': yaw || 0,
                        'x-head-roll': roll || 0,
                        'x-phone-detected': phoneDetected ? 'true' : 'false',
                        'x-books-detected': booksDetected ? 'true' : 'false',
                        'x-earphones-detected': earphonesDetected ? 'true' : 'false'
                    },
                    body: {},
                    headMovementDetector: req.headMovementDetector
                };
                
                // Process head movement for this frame
                await new Promise((resolve, reject) => {
                    processHeadMovement(mockReq, {}, (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
                
                // Collect results
                if (mockReq.headMovement) {
                    results.push(mockReq.headMovement);
                    if (mockReq.headMovement.violations) {
                        allViolations.push(...mockReq.headMovement.violations);
                    }
                }
            }
            
            res.json({
                success: true,
                processedFrames: frames.length,
                violationsFound: allViolations.length,
                violations: allViolations,
                results: results.slice(-10) // Return last 10 results
            });
        } catch (error) {
            console.error('Error processing batch:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to process batch'
            });
        }
    }
);

// Export router
export default router;