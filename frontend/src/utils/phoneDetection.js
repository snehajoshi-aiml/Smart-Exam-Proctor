// phoneDetection.js - Mobile device and phone detection system

class PhoneDetection {
    constructor() {
        this.suspiciousActivities = [];
        this.blurThreshold = 5; // Number of blur events before alert
        this.blurCount = 0;
        this.orientationChangeCount = 0;
        this.deviceInfo = null;
    }

    // Detect if user is on mobile device
    detectMobileDevice() {
        const userAgent = navigator.userAgent || navigator.vendor || window.opera;
        const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
        const isMobile = mobileRegex.test(userAgent);
        
        // Check screen size
        const isSmallScreen = window.innerWidth <= 768;
        
        // Check touch capabilities
        const hasTouchScreen = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        
        return {
            isMobile: isMobile,
            isSmallScreen: isSmallScreen,
            hasTouchScreen: hasTouchScreen,
            userAgent: userAgent
        };
    }

    // Detect secondary phone/camera usage
    detectSecondaryDevice() {
        // Check for multiple displays
        const hasMultipleScreens = window.screen.availWidth > window.screen.width * 1.2;
        
        // Check for unusual window positioning (could indicate phone)
        const windowPosition = {
            x: window.screenX,
            y: window.screenY,
            width: window.outerWidth,
            height: window.outerHeight
        };
        
        // Check for screen recording or mirroring
        const isBeingRecorded = this.detectScreenRecording();
        
        return {
            hasMultipleScreens: hasMultipleScreens,
            windowPosition: windowPosition,
            isBeingRecorded: isBeingRecorded
        };
    }

    // Detect if screen recording is active
    detectScreenRecording() {
        // Check for common screen recording indicators
        const mediaDevices = navigator.mediaDevices;
        let isRecording = false;
        
        // Try to detect if any video track is being captured
        if (mediaDevices && mediaDevices.getDisplayMedia) {
            // This is a heuristic check
            isRecording = window.screen.width > window.innerWidth * 1.1;
        }
        
        return isRecording;
    }

    // Monitor focus and visibility changes (indicating phone usage)
    monitorFocusChanges() {
        let lastFocusTime = Date.now();
        
        window.addEventListener('blur', () => {
            this.blurCount++;
            const timeSinceLastFocus = Date.now() - lastFocusTime;
            
            this.suspiciousActivities.push({
                type: 'window_blur',
                timestamp: new Date(),
                duration: timeSinceLastFocus
            });
            
            if (this.blurCount >= this.blurThreshold) {
                this.triggerAlert('Multiple window switches detected - Possible phone usage');
                this.blurCount = 0; // Reset counter
            }
            
            lastFocusTime = Date.now();
        });
        
        window.addEventListener('focus', () => {
            lastFocusTime = Date.now();
        });
        
        // Monitor visibility change (tab switching)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.suspiciousActivities.push({
                    type: 'tab_switch',
                    timestamp: new Date()
                });
                this.triggerAlert('Tab/window switched - Phone or other application usage');
            }
        });
    }

    // Detect copy-paste operations (potential cheating)
    monitorClipboard() {
        document.addEventListener('copy', (e) => {
            this.suspiciousActivities.push({
                type: 'copy_operation',
                timestamp: new Date(),
                content: e.clipboardData?.getData('text')?.substring(0, 50)
            });
            this.triggerAlert('Copy operation detected');
        });
        
        document.addEventListener('paste', (e) => {
            this.suspiciousActivities.push({
                type: 'paste_operation',
                timestamp: new Date(),
                content: e.clipboardData?.getData('text')?.substring(0, 50)
            });
            this.triggerAlert('Paste operation detected');
        });
    }

    // Monitor network requests for suspicious activity
    monitorNetworkRequests() {
        // Monitor for suspicious outbound requests
        const originalFetch = window.fetch;
        window.fetch = (...args) => {
            const url = args[0];
            if (typeof url === 'string' && this.isSuspiciousUrl(url)) {
                this.suspiciousActivities.push({
                    type: 'suspicious_network_request',
                    timestamp: new Date(),
                    url: url
                });
                this.triggerAlert('Suspicious network activity detected');
            }
            return originalFetch.apply(this, args);
        };
    }

    isSuspiciousUrl(url) {
        const suspiciousDomains = [
            'google.com/search',
            'cheat', 'answers', 'homework',
            'quizlet', 'coursehero', 'chegg',
            'stackoverflow', 'chatgpt', 'bard'
        ];
        return suspiciousDomains.some(domain => url.toLowerCase().includes(domain));
    }

    // Prevent right-click context menu
    preventContextMenu() {
        document.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.suspiciousActivities.push({
                type: 'right_click_attempt',
                timestamp: new Date()
            });
            this.triggerAlert('Right-click attempt detected');
            return false;
        });
    }

    // Prevent keyboard shortcuts for dev tools
    preventDevTools() {
        document.addEventListener('keydown', (e) => {
            // Check for F12
            if (e.key === 'F12') {
                e.preventDefault();
                this.triggerAlert('Developer tools (F12) attempted');
                return false;
            }
            
            // Check for Ctrl+Shift+I (Dev tools)
            if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i')) {
                e.preventDefault();
                this.triggerAlert('Developer tools (Ctrl+Shift+I) attempted');
                return false;
            }
            
            // Check for Ctrl+Shift+J (Console)
            if (e.ctrlKey && e.shiftKey && (e.key === 'J' || e.key === 'j')) {
                e.preventDefault();
                this.triggerAlert('Developer console (Ctrl+Shift+J) attempted');
                return false;
            }
            
            // Check for Ctrl+U (View source)
            if (e.ctrlKey && (e.key === 'U' || e.key === 'u')) {
                e.preventDefault();
                this.triggerAlert('View source (Ctrl+U) attempted');
                return false;
            }
        });
    }

    // Monitor keyboard shortcuts
    monitorKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'F12') {
                e.preventDefault();
                this.triggerAlert('Developer tools attempted');
            }
            
            if (e.ctrlKey && (e.key === 'c' || e.key === 'v' || e.key === 'x')) {
                this.suspiciousActivities.push({
                    type: 'keyboard_shortcut',
                    timestamp: new Date(),
                    shortcut: `Ctrl+${e.key}`
                });
            }
            
            // Detect Alt+Tab (window switching)
            if (e.altKey && e.key === 'Tab') {
                this.triggerAlert('Alt+Tab detected - Window switching');
            }
        });
    }

    triggerAlert(message) {
        console.warn('[Phone Detection Alert]:', message);
        
        // Dispatch custom event for the main application
        const alertEvent = new CustomEvent('phoneDetectionAlert', {
            detail: { message, timestamp: new Date(), activities: this.suspiciousActivities }
        });
        window.dispatchEvent(alertEvent);
        
        // Log to server if needed
        this.logToServer(message);
    }

    logToServer(message) {
        // Send to your backend (commented out if backend not ready)
        try {
            // Uncomment when backend is ready
            /*
            fetch('/api/log-suspicious-activity', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'phone_detection',
                    message: message,
                    activities: this.suspiciousActivities,
                    deviceInfo: this.detectMobileDevice(),
                    timestamp: new Date()
                })
            }).catch(err => console.error('Logging failed:', err));
            */
            
            // Store in localStorage as fallback
            const alerts = JSON.parse(localStorage.getItem('phone_detection_alerts') || '[]');
            alerts.push({
                message: message,
                timestamp: new Date().toISOString(),
                activities: this.suspiciousActivities.slice(-5)
            });
            if (alerts.length > 50) alerts.shift();
            localStorage.setItem('phone_detection_alerts', JSON.stringify(alerts));
        } catch (error) {
            console.error('Logging error:', error);
        }
    }

    init() {
        const deviceInfo = this.detectMobileDevice();
        const secondaryDevice = this.detectSecondaryDevice();
        
        this.monitorFocusChanges();
        this.monitorClipboard();
        this.preventContextMenu();
        this.monitorKeyboardShortcuts();
        this.preventDevTools();
        this.monitorNetworkRequests();
        
        console.log('Phone detection initialized', deviceInfo);
        
        // Return initial detection results
        return {
            deviceInfo: deviceInfo,
            secondaryDevice: secondaryDevice
        };
    }

    getSuspiciousActivities() {
        return this.suspiciousActivities;
    }
}

export default PhoneDetection;