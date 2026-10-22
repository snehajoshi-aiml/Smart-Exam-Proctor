// enhancedProctoringService.js - UPDATED with Phone & Eye Movement Detection
// CORRECTED IMPORT PATHS ✅
import PhoneDetection from '../utils/phoneDetection.js';
import EyeMovementDetection from '../utils/eyeMovementDetection.js';
import { getApiBaseUrl } from '../utils/config.js';

class EnhancedProctoringService {
    constructor() {
        this.isProctoring = false;
        this.logs = [];
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.audioContext = null;
        this.analyser = null;
        this.microphoneStream = null;
        this.volumeInterval = null;
        this.speechDetectionInterval = null;
        this.phoneDetectionInterval = null;
        
        // NEW: Phone and Eye detection instances
        this.phoneDetection = null;
        this.eyeMovementDetection = null;
        this.videoStream = null;
        this.snapshotInterval = null;
        
        // Detection thresholds
        this.VOLUME_THRESHOLD = 0.05;
        this.SPEECH_DURATION_THRESHOLD = 2000;
        this.PHONE_ORIENTATION_THRESHOLD = 30;
    }

    async startProctoring() {
        this.isProctoring = true;
        this.logs = [];
        
        // Start all detection systems
        this.setupTabSwitchDetection();
        this.setupFullscreenDetection();
        await this.setupVoiceDetection();
        await this.setupPhoneDetection();
        await this.setupAdvancedPhoneDetection();
        await this.setupEyeMovementDetection();
        this.startPeriodicSnapshots();
        
        this.addLog('info', 'Proctoring session started with Phone & Eye tracking');
        return true;
    }

    stopProctoring() {
        this.isProctoring = false;
        
        // Clean up all detection systems
        this.cleanupVoiceDetection();
        this.cleanupPhoneDetection();
        this.cleanupAdvancedPhoneDetection();
        this.cleanupEyeMovementDetection();
        this.cleanupTabDetection();
        this.cleanupFullscreenDetection();
        this.cleanupSnapshots();
        
        this.addLog('info', 'Proctoring session ended');
        return this.getSessionData();
    }

    setupTabSwitchDetection() {
        this.handleVisibilityChange = () => {
            if (document.hidden && this.isProctoring) {
                const timestamp = new Date().toISOString();
                this.addLog('violation', `Tab switched at ${timestamp}`);
                this.notifyViolation('Tab switched', timestamp);
            }
        };
        document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }

    setupFullscreenDetection() {
        this.handleFullscreenChange = () => {
            if (!document.fullscreenElement && this.isProctoring) {
                const timestamp = new Date().toISOString();
                this.addLog('warning', `Exited fullscreen mode at ${timestamp}`);
                this.notifyViolation('Exited fullscreen', timestamp);
            }
        };
        document.addEventListener('fullscreenchange', this.handleFullscreenChange);
    }

    async setupVoiceDetection() {
        try {
            this.microphoneStream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                } 
            });
            
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 256;
            
            const source = this.audioContext.createMediaStreamSource(this.microphoneStream);
            source.connect(this.analyser);
            
            const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
            let speechStartTime = null;
            let isSpeaking = false;
            
            this.volumeInterval = setInterval(() => {
                if (!this.isProctoring) return;
                
                this.analyser.getByteTimeDomainData(dataArray);
                let maxSample = 0;
                
                for (let i = 0; i < dataArray.length; i++) {
                    const v = (dataArray[i] - 128) / 128;
                    maxSample = Math.max(maxSample, Math.abs(v));
                }
                
                const volume = maxSample;
                
                if (volume > this.VOLUME_THRESHOLD) {
                    if (!isSpeaking) {
                        isSpeaking = true;
                        speechStartTime = Date.now();
                    }
                    
                    const speechDuration = Date.now() - speechStartTime;
                    if (speechDuration > this.SPEECH_DURATION_THRESHOLD) {
                        this.addLog('warning', `Continuous speech detected for ${Math.floor(speechDuration/1000)} seconds`);
                        this.notifyViolation('Continuous speech detected', new Date().toISOString());
                    }
                    
                    this.recordAudioChunk();
                } else {
                    if (isSpeaking) {
                        isSpeaking = false;
                        speechStartTime = null;
                    }
                }
            }, 100);
            
            this.addLog('info', 'Voice detection activated');
            
        } catch (error) {
            console.error('Error accessing microphone:', error);
            this.addLog('error', 'Microphone access denied - voice detection disabled');
        }
    }

    recordAudioChunk() {
        if (!this.mediaRecorder && this.microphoneStream) {
            this.mediaRecorder = new MediaRecorder(this.microphoneStream);
            this.audioChunks = [];
            
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };
            
            this.mediaRecorder.start(5000);
        }
    }

    async setupAdvancedPhoneDetection() {
        try {
            this.phoneDetection = new PhoneDetection();
            const detectionResults = this.phoneDetection.init();
            
            if (detectionResults.deviceInfo.isMobile) {
                this.addLog('violation', 'Mobile device detected! Please use a desktop computer');
                this.notifyViolation('Mobile device detected', new Date().toISOString());
            }
            
            window.addEventListener('phoneDetectionAlert', (event) => {
                this.handlePhoneAlert(event.detail);
            });
            
            this.addLog('info', 'Advanced phone detection activated', detectionResults);
        } catch (error) {
            console.error('Advanced phone detection failed:', error);
            this.addLog('error', 'Advanced phone detection initialization failed');
        }
    }

    handlePhoneAlert(details) {
        this.addLog('violation', `Phone Detection: ${details.message}`);
        this.notifyViolation(details.message, new Date().toISOString());
        this.captureEvidenceScreenshot('phone_detection');
    }

    async setupEyeMovementDetection() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: "user"
                } 
            });
            
            const videoElement = document.createElement('video');
            videoElement.srcObject = stream;
            videoElement.width = 640;
            videoElement.height = 480;
            videoElement.setAttribute('playsinline', true);
            videoElement.style.display = 'none';
            document.body.appendChild(videoElement);
            const playPromise = videoElement.play();
            if (playPromise !== undefined) {
              playPromise.catch(err => {
                if (err.name !== 'AbortError' && !err.message.includes('interrupted')) {
                  console.warn('Video play warning:', err.message);
                }
              });
            }
            
            this.videoStream = stream;
            
            this.eyeMovementDetection = new EyeMovementDetection(videoElement);
            const loaded = await this.eyeMovementDetection.loadFaceApi();
            
            if (loaded) {
                this.eyeMovementDetection.startDetection();
                
                window.addEventListener('eyeMovementAlert', (event) => {
                    this.handleEyeAlert(event.detail);
                });
                
                this.addLog('info', 'Eye movement detection activated');
            } else {
                this.addLog('warning', 'Face detection models failed to load');
            }
        } catch (error) {
            console.error('Eye movement detection failed:', error);
            this.addLog('error', 'Camera access denied - eye tracking disabled');
        }
    }

    handleEyeAlert(details) {
        if (details.isWarningOnly) {
            this.addLog('warning', `Eye Movement: ${details.message}`);
            return;
        }
        this.addLog('violation', `Eye Movement: ${details.message}`);
        this.notifyViolation(details.message, new Date().toISOString());
        this.captureEvidenceScreenshot('eye_movement');
        
        if (this.eyeMovementDetection) {
            const stats = this.eyeMovementDetection.getStatistics();
            if (stats) {
                this.addLog('info', 'Eye movement statistics', stats);
            }
        }
    }

    async captureEvidenceScreenshot(reason) {
        if (this.eyeMovementDetection && this.eyeMovementDetection.video) {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = this.eyeMovementDetection.video.width;
                canvas.height = this.eyeMovementDetection.video.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(this.eyeMovementDetection.video, 0, 0);
                
                const screenshot = canvas.toDataURL('image/jpeg', 0.7);
                
                const evidence = {
                    id: Date.now(),
                    reason: reason,
                    timestamp: new Date().toISOString(),
                    screenshot: screenshot.substring(0, 200)
                };
                
                const screenshots = JSON.parse(localStorage.getItem('proctoring_evidence') || '[]');
                screenshots.push({
                    ...evidence,
                    fullScreenshot: screenshot
                });
                
                if (screenshots.length > 20) screenshots.shift();
                localStorage.setItem('proctoring_evidence', JSON.stringify(screenshots));
                
                this.addLog('info', `Evidence captured: ${reason}`, { evidenceId: evidence.id });
            } catch (error) {
                console.error('Failed to capture evidence:', error);
            }
        }
    }

    async setupPhoneDetection() {
        if (!window.DeviceOrientationEvent) {
            this.addLog('warning', 'Device orientation not supported');
            return;
        }
        
        if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
            try {
                const permission = await DeviceOrientationEvent.requestPermission();
                if (permission !== 'granted') {
                    this.addLog('warning', 'Device orientation permission denied');
                    return;
                }
            } catch (error) {
                console.error('Error requesting orientation permission:', error);
                return;
            }
        }
        
        let phoneDetectionStartTime = null;
        
        this.handleOrientation = (event) => {
            if (!this.isProctoring) return;
            
            const gamma = Math.abs(event.gamma || 0);
            const beta = Math.abs(event.beta || 0);
            const phoneAngle = Math.max(gamma, beta);
            
            if (phoneAngle > this.PHONE_ORIENTATION_THRESHOLD) {
                if (!phoneDetectionStartTime) {
                    phoneDetectionStartTime = Date.now();
                } else {
                    const duration = Date.now() - phoneDetectionStartTime;
                    if (duration > 3000) {
                        this.addLog('violation', `Phone/Mobile device usage detected (Angle: ${Math.floor(phoneAngle)}°)`);
                        this.notifyViolation('Phone detected via orientation', new Date().toISOString());
                        phoneDetectionStartTime = null;
                    }
                }
            } else {
                phoneDetectionStartTime = null;
            }
        };
        
        window.addEventListener('deviceorientation', this.handleOrientation);
        this.addLog('info', 'Phone detection (orientation) activated');
    }

    startPeriodicSnapshots() {
        this.snapshotInterval = setInterval(async () => {
            if (!this.isProctoring) return;
            
            try {
                const snapshot = await this.captureSnapshot();
                if (snapshot) {
                    this.addLog('info', 'Camera snapshot captured', { snapshot: snapshot.substring(0, 100) });
                    await this.analyzeSnapshot(snapshot);
                }
            } catch (error) {
                console.error('Error capturing snapshot:', error);
            }
        }, 30000);
    }

    async captureSnapshot() {
        if (this.eyeMovementDetection && this.eyeMovementDetection.video) {
            const canvas = document.createElement('canvas');
            canvas.width = this.eyeMovementDetection.video.width;
            canvas.height = this.eyeMovementDetection.video.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(this.eyeMovementDetection.video, 0, 0);
            return canvas.toDataURL('image/jpeg', 0.8);
        }
        return null;
    }

    async analyzeSnapshot(snapshot) {
        if (this.eyeMovementDetection && !this.eyeMovementDetection.faceApiLoaded) {
            this.addLog('warning', 'Face not detected in recent snapshot');
        }
    }

    addLog(type, message, metadata = {}) {
        const log = {
            id: Date.now(),
            type,
            message,
            timestamp: new Date().toISOString(),
            metadata
        };
        
        this.logs.push(log);
        console.log(`[${type.toUpperCase()}]`, message);
        
        this.storeLogLocally(log);
        this.sendLogToBackend(log);
    }

    storeLogLocally(log) {
        const storedLogs = JSON.parse(localStorage.getItem('proctoring_logs') || '[]');
        storedLogs.push(log);
        
        if (storedLogs.length > 1000) {
            storedLogs.shift();
        }
        
        localStorage.setItem('proctoring_logs', JSON.stringify(storedLogs));
    }

    async sendLogToBackend(log) {
        try {
            const apiBase = getApiBaseUrl();
            const response = await fetch(`${apiBase}/api/proctoring/logs`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(log)
            });
            
            if (!response.ok) {
                console.error('Failed to send log to backend');
            }
        } catch (error) {
            console.error('Error sending log to backend:', error);
        }
    }

    notifyViolation(violationType, timestamp) {
        const event = new CustomEvent('proctoringViolation', {
            detail: { violationType, timestamp }
        });
        window.dispatchEvent(event);
        this.showNotification(violationType);
    }

    showNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'proctoring-notification warning';
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-icon">⚠️</span>
                <span class="notification-message">${message}</span>
            </div>
        `;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            padding: 12px 20px;
            background: #ff9800;
            color: white;
            border-radius: 8px;
            animation: slideIn 0.3s ease-out;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        `;
        
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
    }

    getSessionData() {
        let eyeStats = null;
        if (this.eyeMovementDetection) {
            eyeStats = this.eyeMovementDetection.getStatistics();
        }
        
        return {
            logs: this.logs,
            startTime: this.logs[0]?.timestamp,
            endTime: new Date().toISOString(),
            totalViolations: this.logs.filter(l => l.type === 'violation').length,
            warnings: this.logs.filter(l => l.type === 'warning').length,
            eyeMovementStats: eyeStats,
            proctoringActive: this.isProctoring
        };
    }

    cleanupTabDetection() {
        if (this.handleVisibilityChange) {
            document.removeEventListener('visibilitychange', this.handleVisibilityChange);
        }
    }

    cleanupFullscreenDetection() {
        if (this.handleFullscreenChange) {
            document.removeEventListener('fullscreenchange', this.handleFullscreenChange);
        }
    }

    cleanupPhoneDetection() {
        if (this.handleOrientation) {
            window.removeEventListener('deviceorientation', this.handleOrientation);
        }
    }

    cleanupAdvancedPhoneDetection() {
        if (this.phoneDetection) {
            window.removeEventListener('phoneDetectionAlert', this.handlePhoneAlert);
        }
    }

    cleanupEyeMovementDetection() {
        if (this.eyeMovementDetection) {
            this.eyeMovementDetection.stopDetection();
            window.removeEventListener('eyeMovementAlert', this.handleEyeAlert);
        }
        
        if (this.videoStream) {
            this.videoStream.getTracks().forEach(track => track.stop());
        }
    }

    cleanupVoiceDetection() {
        if (this.volumeInterval) clearInterval(this.volumeInterval);
        if (this.speechDetectionInterval) clearInterval(this.speechDetectionInterval);
        
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.stop();
        }
        
        if (this.audioContext) {
            this.audioContext.close();
        }
        
        if (this.microphoneStream) {
            this.microphoneStream.getTracks().forEach(track => track.stop());
        }
    }

    cleanupSnapshots() {
        if (this.snapshotInterval) {
            clearInterval(this.snapshotInterval);
        }
    }
}

const enhancedProctoringService = new EnhancedProctoringService();
export default enhancedProctoringService;