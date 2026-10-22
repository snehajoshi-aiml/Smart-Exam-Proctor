import * as faceapi from '@vladmandic/face-api';
import { getApiBaseUrl } from './config';
// eyeMovementDetection.js - High-accuracy eye tracking, gaze analysis, & head-pose detection
// Fixed: proper model loading guards to prevent "TinyYolov2 - load model before inference"

class EyeMovementDetection {
    constructor(videoElement) {
        this.video = videoElement;
        this.faceDetectionInterval = null;
        this.eyePositions = [];
        this.suspiciousEyeMovements = [];
        this.faceApiLoaded = false;
        
        // Calibration & Baseline
        this.calibrationFrames = 0;
        this.MAX_CALIBRATION_FRAMES = 30; // ~3 seconds calibration
        this.isCalibrating = true;
        this.isCalibrated = false;
        this.calibrationData = {
            hRatioSum: 0,
            vRatioSum: 0,
            yawSum: 0,
            pitchSum: 0,
            baseHRatio: 0.5,
            baseVRatio: 0.5,
            baseYaw: 0,
            basePitch: 0.45
        };

        // EMA Smoothed Values
        this.smoothedHRatio = 0.5;
        this.smoothedVRatio = 0.5;
        this.smoothedYaw = 0;
        this.smoothedPitch = 0.45;
        this.alpha = 0.3; // Smoothing factor

        // Stats & Counters
        this.lastEyePosition = { x: 0, y: 0 };
        this.lastTimestamp = Date.now();
        this.lookingAwayCount = 0;
        this.excessiveMovementCount = 0;
        this.blinkCount = 0;
        this.isBlinking = false;
        this.consecutiveOffCenterFrames = 0;
        this.lastAlertTime = 0;

        // Continuous Eye/Iris Gaze Down Tracking (10 continuous seconds)
        this.DOWNWARD_GAZE_VIOLATION_SECONDS = 10;
        this.downGazeStartTime = null;
        this.downGazeViolationEmitted = false;

        // Offscreen canvas for pupil intensity extraction
        this.offscreenCanvas = document.createElement('canvas');
        this.offscreenCtx = this.offscreenCanvas.getContext('2d', { willReadFrequently: true });
    }

    async loadFaceApi() {
        try {
            if (typeof faceapi === 'undefined') {
                console.error('FaceAPI not loaded. Please ensure face-api.js is installed.');
                return false;
            }

            console.log('🔄 Loading FaceAPI models for eye tracking...');
            
            try {
                await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
                await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
                // faceRecognitionNet is optional for eye tracking, but load if available
                await faceapi.nets.faceRecognitionNet.loadFromUri('/models').catch(() => {
                    console.warn('⚠️ faceRecognitionNet not loaded (optional for eye tracking)');
                });

                // CRITICAL: Verify models actually loaded (catches 0-byte/corrupt files)
                if (!faceapi.nets.tinyFaceDetector.isLoaded) {
                    throw new Error('TinyFaceDetector model files are empty or corrupt');
                }
                if (!faceapi.nets.faceLandmark68Net.isLoaded) {
                    throw new Error('FaceLandmark68Net model files are empty or corrupt');
                }
                
                this.faceApiLoaded = true;
                console.log('✅ FaceAPI models loaded successfully for eye tracking');
                return true;
            } catch (modelError) {
                console.error('❌ Failed to load FaceAPI models:', modelError.message);
                this.faceApiLoaded = false;
                return false;
            }
        } catch (error) {
            console.error('❌ Error loading FaceAPI models:', error);
            this.faceApiLoaded = false;
            return false;
        }
    }

    // Reset calibration to re-calibrate neutral gaze
    recalibrate() {
        this.isCalibrated = false;
        this.isCalibrating = true;
        this.calibrationFrames = 0;
        this.calibrationData = {
            hRatioSum: 0,
            vRatioSum: 0,
            yawSum: 0,
            pitchSum: 0,
            baseHRatio: 0.5,
            baseVRatio: 0.5,
            baseYaw: 0,
            basePitch: 0.45
        };
        console.log('Eye tracking recalibration started...');
    }

    async detectEyes() {
        // Guard 1: Models must be loaded
        if (!this.faceApiLoaded) {
            return null;
        }

        // Guard 2: Video must exist, have valid dimensions, and be playing
        if (!this.video || !this.video.videoWidth || !this.video.videoHeight || this.video.videoWidth === 0 || this.video.videoHeight === 0 || this.video.paused || this.video.ended) {
            return null;
        }

        // Guard 3: Video must be fully active with non-zero dimensions
        if (!this.video || this.video.paused || this.video.ended || this.video.readyState < 2 || !this.video.videoWidth || !this.video.videoHeight || this.video.videoWidth === 0 || this.video.videoHeight === 0) {
            return null;
        }

        // Guard 4: TinyFaceDetector must be loaded (critical check)
        if (!faceapi.nets.tinyFaceDetector.isLoaded) {
            console.warn('⚠️ TinyFaceDetector not loaded, skipping eye detection');
            return null;
        }

        // Guard 5: FaceLandmark68Net must be loaded (required for eye landmarks)
        if (!faceapi.nets.faceLandmark68Net.isLoaded) {
            console.warn('⚠️ FaceLandmark68Net not loaded, skipping eye detection');
            return null;
        }

        try {
            const detection = await faceapi.detectSingleFace(
                this.video,
                new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 })
            ).withFaceLandmarks();

            if (!detection || !detection.box || typeof detection.box.x !== 'number' || detection.box.x === null || !detection.landmarks) {
                return null;
            }


            if (detection && detection.landmarks) {
                const landmarks = detection.landmarks;
                const leftEye = landmarks.getLeftEye();
                const rightEye = landmarks.getRightEye();
                const nose = landmarks.getNose();
                const mouth = landmarks.getMouth();

                const eyeCenter = this.calculateEyeCenter(leftEye, rightEye);
                const ear = this.calculateEyeAspectRatio(leftEye, rightEye);

                // Pupil localization via intensity weighting
                const leftPupil = this.estimatePupilCenter(leftEye);
                const rightPupil = this.estimatePupilCenter(rightEye);

                // Calculate Horizontal & Vertical Gaze Ratios
                const hRatioLeft = this.calculateSingleEyeHRatio(leftEye, leftPupil);
                const hRatioRight = this.calculateSingleEyeHRatio(rightEye, rightPupil);
                const rawHRatio = (hRatioLeft + hRatioRight) / 2;

                const vRatioLeft = this.calculateSingleEyeVRatio(leftEye, leftPupil);
                const vRatioRight = this.calculateSingleEyeVRatio(rightEye, rightPupil);
                const rawVRatio = (vRatioLeft + vRatioRight) / 2;

                // Calculate Head Pose (Yaw & Pitch)
                const { yaw, pitch } = this.calculateHeadPose(leftEye, rightEye, nose, mouth);

                // Apply Calibration or Update Calibration Baseline
                if (this.isCalibrating) {
                    this.calibrationData.hRatioSum += rawHRatio;
                    this.calibrationData.vRatioSum += rawVRatio;
                    this.calibrationData.yawSum += yaw;
                    this.calibrationData.pitchSum += pitch;
                    this.calibrationFrames++;

                    if (this.calibrationFrames >= this.MAX_CALIBRATION_FRAMES) {
                        this.calibrationData.baseHRatio = this.calibrationData.hRatioSum / this.MAX_CALIBRATION_FRAMES;
                        this.calibrationData.baseVRatio = this.calibrationData.vRatioSum / this.MAX_CALIBRATION_FRAMES;
                        this.calibrationData.baseYaw = this.calibrationData.yawSum / this.MAX_CALIBRATION_FRAMES;
                        this.calibrationData.basePitch = this.calibrationData.pitchSum / this.MAX_CALIBRATION_FRAMES;
                        this.isCalibrated = true;
                        this.isCalibrating = false;
                        console.log('✅ Eye tracking calibration complete:', this.calibrationData);
                    }
                }

                // Apply EMA Smoothing
                this.smoothedHRatio = this.alpha * rawHRatio + (1 - this.alpha) * this.smoothedHRatio;
                this.smoothedVRatio = this.alpha * rawVRatio + (1 - this.alpha) * this.smoothedVRatio;
                this.smoothedYaw = this.alpha * yaw + (1 - this.alpha) * this.smoothedYaw;
                this.smoothedPitch = this.alpha * pitch + (1 - this.alpha) * this.smoothedPitch;

                // Determine gaze direction based purely on pupil eye landmarks
                const gazeDirection = this.determineGazeDirection(
                    this.smoothedHRatio,
                    this.smoothedVRatio,
                    ear
                );

                // Determine head direction independently based purely on face pose landmarks
                const headDirection = this.determineHeadDirection(
                    this.smoothedYaw,
                    this.smoothedPitch
                );

                return {
                    leftEye,
                    rightEye,
                    center: eyeCenter,
                    gazeDirection,
                    headDirection,
                    ear,
                    hRatio: this.smoothedHRatio,
                    vRatio: this.smoothedVRatio,
                    yaw: this.smoothedYaw,
                    pitch: this.smoothedPitch,
                    isCalibrated: this.isCalibrated,
                    isCalibrating: this.isCalibrating,
                    calibrationProgress: Math.min(100, Math.round((this.calibrationFrames / this.MAX_CALIBRATION_FRAMES) * 100)),
                    timestamp: Date.now()
                };
            }
        } catch (error) {
            // Graceful error handling - don't crash the detection loop
            if (error.message && error.message.includes('load model before inference')) {
                console.error('⚠️ Model not loaded error in eye detection. Stopping detection.');
                this.faceApiLoaded = false;
                this.stopDetection();
            } else {
                console.error('Eye detection processing error:', error);
            }
        }
        return null;
    }

    estimatePupilCenter(eyePoints) {
        if (!this.video || !this.video.videoWidth || !this.video.videoHeight) {
            const avgX = eyePoints.reduce((sum, p) => sum + p.x, 0) / eyePoints.length;
            const avgY = eyePoints.reduce((sum, p) => sum + p.y, 0) / eyePoints.length;
            return { x: avgX, y: avgY };
        }

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        eyePoints.forEach(pt => {
            if (pt.x < minX) minX = pt.x;
            if (pt.x > maxX) maxX = pt.x;
            if (pt.y < minY) minY = pt.y;
            if (pt.y > maxY) maxY = pt.y;
        });

        const vW = this.video.videoWidth;
        const vH = this.video.videoHeight;

        const cropX = Math.max(0, Math.floor(minX));
        const cropY = Math.max(0, Math.floor(minY));
        const cropW = Math.min(vW - cropX, Math.max(1, Math.ceil(maxX - minX)));
        const cropH = Math.min(vH - cropY, Math.max(1, Math.ceil(maxY - minY)));

        if (cropW <= 0 || cropH <= 0) {
            const avgX = eyePoints.reduce((sum, p) => sum + p.x, 0) / eyePoints.length;
            const avgY = eyePoints.reduce((sum, p) => sum + p.y, 0) / eyePoints.length;
            return { x: avgX, y: avgY };
        }

        try {
            this.offscreenCanvas.width = cropW;
            this.offscreenCanvas.height = cropH;
            this.offscreenCtx.drawImage(
                this.video,
                cropX, cropY, cropW, cropH,
                0, 0, cropW, cropH
            );

            const imgData = this.offscreenCtx.getImageData(0, 0, cropW, cropH);
            const data = imgData.data;

            let minGray = 255;
            for (let i = 0; i < data.length; i += 4) {
                if (data[i + 3] >= 128) {
                    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
                    if (gray < minGray) minGray = gray;
                }
            }

            let totalWeight = 0;
            let weightedX = 0;
            let weightedY = 0;
            const threshold = Math.min(minGray + 30, 110);

            for (let y = 0; y < cropH; y++) {
                for (let x = 0; x < cropW; x++) {
                    const idx = (y * cropW + x) * 4;
                    if (data[idx + 3] >= 128) {
                        const gray = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
                        if (gray <= threshold) {
                            const weight = Math.pow(255 - gray, 2);
                            totalWeight += weight;
                            weightedX += x * weight;
                            weightedY += y * weight;
                        }
                    }
                }
            }

            if (totalWeight > 0) {
                return {
                    x: cropX + (weightedX / totalWeight),
                    y: cropY + (weightedY / totalWeight)
                };
            }
        } catch (e) {
            // Fallback to geometric centroid of eye points if canvas sampling fails
        }

        const avgX = eyePoints.reduce((sum, p) => sum + p.x, 0) / eyePoints.length;
        const avgY = eyePoints.reduce((sum, p) => sum + p.y, 0) / eyePoints.length;
        return { x: avgX, y: avgY };
    }

    calculateSingleEyeHRatio(eye, pupil) {
        // Inner and outer corners
        const pLeft = eye[0]; // outer left or inner left
        const pRight = eye[3]; // inner right or outer right
        const dx = pRight.x - pLeft.x;
        if (Math.abs(dx) < 1e-3) return 0.5;
        const ratio = (pupil.x - pLeft.x) / dx;
        return Math.max(0, Math.min(1, ratio));
    }

    calculateSingleEyeVRatio(eye, pupil) {
        const topY = Math.min(eye[1].y, eye[2].y);
        const bottomY = Math.max(eye[4].y, eye[5].y);
        const dy = bottomY - topY;
        if (Math.abs(dy) < 1e-3) return 0.5;
        const ratio = (pupil.y - topY) / dy;
        return Math.max(0, Math.min(1, ratio));
    }

    calculateHeadPose(leftEye, rightEye, nose, mouth) {
        const leftCenter = this.getPointAverage(leftEye);
        const rightCenter = this.getPointAverage(rightEye);
        const noseTip = nose[3] || nose[0];
        const mouthCenter = this.getPointAverage(mouth);

        const eyeCenter = {
            x: (leftCenter.x + rightCenter.x) / 2,
            y: (leftCenter.y + rightCenter.y) / 2
        };

        const eyeDist = Math.hypot(rightCenter.x - leftCenter.x, rightCenter.y - leftCenter.y) || 1;
        
        // Yaw: nose horizontal offset relative to eye center
        const yaw = (noseTip.x - eyeCenter.x) / eyeDist;

        // Pitch: nose vertical distance between eye line and mouth
        const vertDist = Math.abs(mouthCenter.y - eyeCenter.y) || 1;
        const pitch = (noseTip.y - eyeCenter.y) / vertDist;

        return { yaw, pitch };
    }

    getPointAverage(points) {
        const sum = points.reduce((acc, pt) => ({ x: acc.x + pt.x, y: acc.y + pt.y }), { x: 0, y: 0 });
        return { x: sum.x / points.length, y: sum.y / points.length };
    }

    calculateEyeCenter(leftEye, rightEye) {
        const left = this.getPointAverage(leftEye);
        const right = this.getPointAverage(rightEye);
        return { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2 };
    }

    calculateEyeAspectRatio(leftEye, rightEye) {
        return (this.calculateEAR(leftEye) + this.calculateEAR(rightEye)) / 2;
    }

    calculateEAR(eye) {
        const p1 = eye[0], p2 = eye[1], p3 = eye[2], p4 = eye[3], p5 = eye[4], p6 = eye[5];
        const v1 = Math.hypot(p2.x - p6.x, p2.y - p6.y);
        const v2 = Math.hypot(p3.x - p5.x, p3.y - p5.y);
        const h = Math.hypot(p1.x - p4.x, p1.y - p4.y);
        if (h === 0) return 0;
        return (v1 + v2) / (2.0 * h);
    }

    determineHeadDirection(yaw, pitch) {
        const deltaYaw = yaw - (this.calibrationData?.baseYaw || 0);
        const deltaPitch = pitch - (this.calibrationData?.basePitch || 0.45);

        // Independent physical head direction from face pose landmarks
        if (deltaYaw > 0.14) return 'left';
        if (deltaYaw < -0.14) return 'right';
        if (deltaPitch > 0.12) return 'down';
        if (deltaPitch < -0.12) return 'up';
        return 'center';
    }

    determineGazeDirection(hRatio, vRatio, ear) {
        // EAR check for blink
        if (ear < 0.16) {
            return 'blinking';
        }

        const deltaH = hRatio - this.calibrationData.baseHRatio;
        const deltaV = vRatio - this.calibrationData.baseVRatio;

        // Independent eye gaze direction from pupil position
        if (deltaH < -0.07) return 'left';
        if (deltaH > 0.07) return 'right';
        if (deltaV > 0.08) return 'down';
        if (deltaV < -0.08) return 'up';

        return 'center';
    }

    analyzeEyeMovements(eyeData) {
        if (!eyeData) return;

        const { gazeDirection, headDirection, center } = eyeData;
        const now = Date.now();

        // Handle blinking count (normal blinking is ignored)
        if (gazeDirection === 'blinking') {
            if (!this.isBlinking) {
                this.isBlinking = true;
                this.blinkCount++;
            }
            return;
        } else {
            this.isBlinking = false;
        }

        // =========================================================================
        // 10-SECOND CONTINUOUS EYE/IRIS GAZE DOWN VIOLATION
        // Head pose has ZERO influence on this detection. Only eye gaze DOWN starts timer.
        // =========================================================================
        if (gazeDirection === 'down' && this.isCalibrated) {
            if (this.downGazeStartTime === null) {
                this.downGazeStartTime = now;
                this.downGazeViolationEmitted = false;
            }

            const downDurationSec = (now - this.downGazeStartTime) / 1000;

            // 10 continuous seconds of eye/iris DOWN -> ONE violation
            if (downDurationSec >= this.DOWNWARD_GAZE_VIOLATION_SECONDS && !this.downGazeViolationEmitted) {
                this.triggerAlert('Looking Down for Long Duration', 'down');
                this.downGazeViolationEmitted = true;
            }
        } else {
            // Eye/iris changed away from DOWN -> reset continuous downward timer and violation flag
            this.downGazeStartTime = null;
            this.downGazeViolationEmitted = false;
        }

        // Dispatch live gaze update event for UI visual widget
        const gazeEvent = new CustomEvent('gazeUpdate', {
            detail: {
                direction: gazeDirection,
                headDirection: headDirection || 'center',
                isCalibrating: eyeData.isCalibrating,
                isCalibrated: eyeData.isCalibrated,
                calibrationProgress: eyeData.calibrationProgress,
                hRatio: eyeData.hRatio,
                vRatio: eyeData.vRatio,
                yaw: eyeData.yaw,
                pitch: eyeData.pitch,
                blinkCount: this.blinkCount
            }
        });
        window.dispatchEvent(gazeEvent);

        // Movement speed track
        const timeDiff = now - this.lastTimestamp;
        if (timeDiff > 100) {
            const dx = center.x - this.lastEyePosition.x;
            const dy = center.y - this.lastEyePosition.y;
            const dist = Math.hypot(dx, dy);
            const speed = dist / timeDiff;

            this.eyePositions.push({ position: center, speed, timestamp: now });
            if (this.eyePositions.length > 500) this.eyePositions.shift();

            this.lastEyePosition = center;
            this.lastTimestamp = now;
        }
    }

    startDetection() {
        if (!this.video) {
            console.error('Video element not provided to EyeMovementDetection');
            return;
        }

        // CRITICAL: Don't start detection if models aren't loaded
        if (!this.faceApiLoaded) {
            console.error('⚠️ Cannot start eye detection: FaceAPI models not loaded');
            return;
        }

        // Double-check that the critical model is actually loaded
        if (!faceapi.nets.tinyFaceDetector.isLoaded) {
            console.error('⚠️ Cannot start eye detection: TinyFaceDetector not loaded');
            this.faceApiLoaded = false;
            return;
        }

        console.log('🚀 Starting high-accuracy eye movement detection loop...');

        // Register keyboard & mouse/touchpad interaction listeners
        if (typeof window !== 'undefined' && this.handleUserInteraction) {
            window.addEventListener('keydown', this.handleUserInteraction, { passive: true });
            window.addEventListener('mousemove', this.handleUserInteraction, { passive: true });
            window.addEventListener('mousedown', this.handleUserInteraction, { passive: true });
            window.addEventListener('touchstart', this.handleUserInteraction, { passive: true });
            window.addEventListener('wheel', this.handleUserInteraction, { passive: true });
        }

        this.faceDetectionInterval = setInterval(async () => {
            // Safety: skip if video not ready
            if (!this.video || this.video.paused || this.video.ended) return;

            // Safety: skip if models became unloaded
            if (!this.faceApiLoaded || !faceapi.nets.tinyFaceDetector.isLoaded) {
                console.warn('⚠️ Models unloaded during detection, stopping...');
                this.stopDetection();
                return;
            }

            const eyeData = await this.detectEyes();
            if (eyeData) {
                this.lookingAwayCount = 0;
                this.analyzeEyeMovements(eyeData);
            } else {
                // Face missing alert logic
                this.lookingAwayCount++;
                if (this.lookingAwayCount > 15 && (Date.now() - this.lastAlertTime > 5000)) {
                    this.triggerAlert('Face not visible - Please remain in front of the camera', 'face_missing');
                    this.lastAlertTime = Date.now();
                    this.lookingAwayCount = 0;
                }
            }
        }, 100);
    }

    stopDetection() {
        if (this.faceDetectionInterval) {
            clearInterval(this.faceDetectionInterval);
            this.faceDetectionInterval = null;
        }

        // Clean up keyboard & mouse interaction listeners
        if (typeof window !== 'undefined' && this.handleUserInteraction) {
            window.removeEventListener('keydown', this.handleUserInteraction);
            window.removeEventListener('mousemove', this.handleUserInteraction);
            window.removeEventListener('mousedown', this.handleUserInteraction);
            window.removeEventListener('touchstart', this.handleUserInteraction);
            window.removeEventListener('wheel', this.handleUserInteraction);
        }

        // Reset downward gaze timers
        this.downGazeStartTime = null;
        this.downGazeWarningEmitted = false;
        this.downGazeViolationEmitted = false;

        console.log('Eye movement detection stopped');
    }

    triggerWarning(message, direction = 'unknown') {
        console.warn('[Eye Tracking Warning]:', message);

        const alertEvent = new CustomEvent('eyeMovementAlert', {
            detail: {
                message,
                direction,
                isWarningOnly: true,
                timestamp: new Date().toISOString(),
                blinkCount: this.blinkCount
            }
        });
        window.dispatchEvent(alertEvent);
    }

    triggerAlert(message, direction = 'unknown') {
        console.warn('[Eye Tracking Alert]:', message);

        const alertEvent = new CustomEvent('eyeMovementAlert', {
            detail: {
                message,
                direction,
                isWarningOnly: false,
                timestamp: new Date().toISOString(),
                blinkCount: this.blinkCount
            }
        });
        window.dispatchEvent(alertEvent);

        this.logToServer(message, direction);
    }

    logToServer(message, direction = 'unknown') {
        try {
            const timestamp = new Date().toISOString();
            const alerts = JSON.parse(localStorage.getItem('eye_movement_alerts') || '[]');
            alerts.push({
                message,
                timestamp,
                blinkCount: this.blinkCount,
                direction
            });
            if (alerts.length > 50) alerts.shift();
            localStorage.setItem('eye_movement_alerts', JSON.stringify(alerts));

            // Post real-time alert to backend API
            const token = localStorage.getItem('token') || localStorage.getItem('authToken');
            const studentId = localStorage.getItem('studentId') || ('STU_' + Date.now());
            const sessionId = localStorage.getItem('sessionId') || ('sess_' + Date.now());
            const apiBase = getApiBaseUrl();

            fetch(`${apiBase}/api/log-suspicious-activity`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({
                    type: 'eye_movement',
                    message,
                    timestamp,
                    metadata: {
                        direction,
                        blinkCount: this.blinkCount,
                        yaw: this.smoothedYaw,
                        pitch: this.smoothedPitch,
                        hRatio: this.smoothedHRatio,
                        vRatio: this.smoothedVRatio
                    }
                })
            }).catch(err => console.warn('Failed to post eye alert to server:', err.message));

            fetch(`${apiBase}/api/violations/log`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify({
                    studentId,
                    sessionId,
                    type: 'eye_movement',
                    severity: 'medium',
                    description: message,
                    metadata: { direction, blinkCount: this.blinkCount }
                })
            }).catch(() => {});
        } catch (error) {
            console.error('Error logging alert to storage/server:', error);
        }
    }

    getStatistics() {
        return {
            isCalibrated: this.isCalibrated,
            isCalibrating: this.isCalibrating,
            calibrationProgress: Math.min(100, Math.round((this.calibrationFrames / this.MAX_CALIBRATION_FRAMES) * 100)),
            blinkCount: this.blinkCount,
            faceApiLoaded: this.faceApiLoaded,
            hRatio: this.smoothedHRatio,
            vRatio: this.smoothedVRatio,
            yaw: this.smoothedYaw,
            pitch: this.smoothedPitch
        };
    }
}

export default EyeMovementDetection;