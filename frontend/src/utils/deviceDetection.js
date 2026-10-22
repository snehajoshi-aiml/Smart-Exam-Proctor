// frontend/src/utils/deviceDetection.js

import React from 'react'; // Add React import for the hook

// Simple phone detection function
export function detectPhone() {
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    
    // Check for mobile devices
    const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
    
    // Check screen size
    const isSmallScreen = window.innerWidth <= 768;
    
    // Detect if it's a phone (not tablet)
    const isPhone = isMobile && !/ipad|tablet/i.test(userAgent.toLowerCase());
    
    // Detect specific device type
    let deviceType = "desktop";
    if (isPhone) deviceType = "phone";
    else if (isMobile) deviceType = "tablet";
    
    return {
        isPhone: isPhone || (isMobile && isSmallScreen),
        isMobile: isMobile,
        deviceType: deviceType,
        screenWidth: window.innerWidth,
        screenHeight: window.innerHeight,
        userAgent: userAgent,
        timestamp: new Date().toISOString()
    };
}

// React Hook for phone detection
export function usePhoneDetection() {
    const [isPhone, setIsPhone] = React.useState(false);
    const [deviceInfo, setDeviceInfo] = React.useState(null);
    
    React.useEffect(() => {
        const checkDevice = () => {
            const detection = detectPhone();
            setIsPhone(detection.isPhone);
            setDeviceInfo(detection);
        };
        
        checkDevice();
        window.addEventListener('resize', checkDevice);
        
        return () => window.removeEventListener('resize', checkDevice);
    }, []);
    
    return { isPhone, deviceInfo };
}

// Warning function for proctoring
export function showPhoneWarning() {
    const { isPhone } = detectPhone();
    
    if (isPhone) {
        const message = "⚠️ Warning: Mobile devices are not recommended for proctored exams.\n\nPlease use a desktop/laptop with:\n• Webcam access\n• Stable internet connection\n• Full screen display\n\nContinuing on mobile may affect your exam experience.";
        alert(message);
        return true;
    }
    return false;
}

// Block exam on phone
export function canTakeExam() {
    const { isPhone } = detectPhone();
    
    if (isPhone) {
        alert("❌ Access Restricted: Proctored exams can only be taken on desktop/laptop devices.\n\nPlease log in from a computer to take this exam.");
        return false;
    }
    return true;
}

// Get device info for logging
export function getDeviceInfoForLogging() {
    const device = detectPhone();
    return {
        userAgent: device.userAgent,
        isMobile: device.isMobile,
        deviceType: device.deviceType,
        screenResolution: `${device.screenWidth}x${device.screenHeight}`,
        timestamp: device.timestamp,
        screenWidth: device.screenWidth,
        screenHeight: device.screenHeight
    };
}

// Additional utility function: Check if device has required features for proctoring
export function hasRequiredFeatures() {
    const { isPhone } = detectPhone();
    
    // Check for webcam support
    const hasWebcam = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    
    // Check for screen capture support
    const hasScreenCapture = !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);
    
    // Check for fullscreen support
    const hasFullscreen = !!(document.documentElement.requestFullscreen);
    
    return {
        isAllowed: !isPhone && hasWebcam,
        hasWebcam: hasWebcam,
        hasScreenCapture: hasScreenCapture,
        hasFullscreen: hasFullscreen,
        issues: [
            ...(isPhone ? ["Mobile devices not supported"] : []),
            ...(!hasWebcam ? ["Webcam not detected"] : []),
            ...(!hasScreenCapture ? ["Screen capture not supported"] : []),
            ...(!hasFullscreen ? ["Fullscreen mode not supported"] : [])
        ]
    };
}

// Real-time device monitoring (for exam integrity)
export function startDeviceMonitoring(callback) {
    let intervalId;
    let lastDeviceState = detectPhone();
    
    const monitor = () => {
        const currentState = detectPhone();
        
        // Check if device changed (e.g., switched from desktop to mobile view)
        if (currentState.isPhone !== lastDeviceState.isPhone || 
            currentState.deviceType !== lastDeviceState.deviceType) {
            callback({
                type: "DEVICE_CHANGED",
                previous: lastDeviceState,
                current: currentState,
                timestamp: new Date().toISOString()
            });
            lastDeviceState = currentState;
        }
        
        // Check for developer tools (optional)
        if (window.devtools && window.devtools.open) {
            callback({
                type: "DEV_TOOLS_OPENED",
                timestamp: new Date().toISOString()
            });
        }
    };
    
    intervalId = setInterval(monitor, 2000); // Check every 2 seconds
    
    // Return function to stop monitoring
    return () => {
        if (intervalId) clearInterval(intervalId);
    };
}

// Force redirect for mobile devices
export function redirectIfMobile(redirectUrl = "/device-not-supported") {
    const { isPhone } = detectPhone();
    
    if (isPhone) {
        window.location.href = redirectUrl;
        return true;
    }
    return false;
}

// Show persistent warning banner (better than alert)
export function showPersistentWarning() {
    const { isPhone } = detectPhone();
    
    if (isPhone && !sessionStorage.getItem("warningShown")) {
        const warningDiv = document.createElement("div");
        warningDiv.id = "mobile-warning-banner";
        warningDiv.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%);
            color: white;
            text-align: center;
            padding: 15px;
            z-index: 10000;
            font-family: Arial, sans-serif;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
            animation: slideDown 0.5s ease;
            cursor: pointer;
        `;
        
        warningDiv.innerHTML = `
            <strong>⚠️ Mobile Device Detected!</strong> 
            For best proctoring experience, please use a desktop/laptop.
            <button onclick="this.parentElement.remove()" style="
                margin-left: 15px;
                background: white;
                border: none;
                padding: 5px 15px;
                border-radius: 5px;
                cursor: pointer;
                font-weight: bold;
                color: #ee5a24;
            ">Dismiss</button>
        `;
        
        // Add animation style if not exists
        if (!document.querySelector("#warning-animation-style")) {
            const style = document.createElement("style");
            style.id = "warning-animation-style";
            style.textContent = `
                @keyframes slideDown {
                    from {
                        transform: translateY(-100%);
                    }
                    to {
                        transform: translateY(0);
                    }
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.insertBefore(warningDiv, document.body.firstChild);
        sessionStorage.setItem("warningShown", "true");
        
        // Auto remove after 10 seconds
        setTimeout(() => {
            if (warningDiv && warningDiv.remove) {
                warningDiv.remove();
            }
        }, 10000);
        
        return true;
    }
    return false;
}

// ============= NEW FUNCTIONS ADDED FOR EXAM.JS =============

// Generate device fingerprint
export async function getDeviceFingerprint() {
    try {
        const device = detectPhone();
        
        // Collect device information for fingerprint
        const fingerprintData = {
            userAgent: navigator.userAgent,
            language: navigator.language,
            languages: navigator.languages,
            platform: navigator.platform,
            screenResolution: `${window.screen.width}x${window.screen.height}`,
            screenAvailable: `${window.screen.availWidth}x${window.screen.availHeight}`,
            colorDepth: window.screen.colorDepth,
            pixelRatio: window.devicePixelRatio,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            touchSupport: 'ontouchstart' in window,
            maxTouchPoints: navigator.maxTouchPoints || 0,
            hardwareConcurrency: navigator.hardwareConcurrency || 'unknown',
            deviceMemory: navigator.deviceMemory || 'unknown',
            deviceType: device.deviceType,
            isPhone: device.isPhone,
            timestamp: Date.now()
        };
        
        // Generate a simple hash (since crypto might not be available in non-HTTPS)
        const fingerprintString = JSON.stringify(fingerprintData);
        
        // Simple hash function as fallback
        const simpleHash = (str) => {
            let hash = 0;
            for (let i = 0; i < str.length; i++) {
                const char = str.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash; // Convert to 32-bit integer
            }
            return Math.abs(hash).toString(16);
        };
        
        // Try to use crypto.subtle if available (HTTPS or localhost)
        let hashHex = simpleHash(fingerprintString);
        
        if (window.crypto && window.crypto.subtle) {
            try {
                const encoder = new TextEncoder();
                const data = encoder.encode(fingerprintString);
                const hashBuffer = await crypto.subtle.digest('SHA-256', data);
                const hashArray = Array.from(new Uint8Array(hashBuffer));
                hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            } catch (cryptoError) {
                console.warn("Crypto subtle not available, using simple hash");
            }
        }
        
        return {
            hash: hashHex,
            details: fingerprintData
        };
    } catch (error) {
        console.error("Error generating device fingerprint:", error);
        return {
            hash: `fallback_${Date.now()}`,
            details: { error: "Fingerprint generation failed" }
        };
    }
}

// Check screen size with detailed information
export function checkScreenSize() {
    return {
        width: window.innerWidth,
        height: window.innerHeight,
        screenWidth: window.screen.width,
        screenHeight: window.screen.height,
        isMobile: window.innerWidth <= 768,
        isTablet: window.innerWidth > 768 && window.innerWidth <= 1024,
        isDesktop: window.innerWidth > 1024,
        meetsMinimum: window.innerWidth >= 1024 && window.innerHeight >= 768,
        aspectRatio: (window.innerWidth / window.innerHeight).toFixed(2)
    };
}

// Check user agent details
export function checkUserAgent() {
    const ua = navigator.userAgent;
    
    const getBrowser = () => {
        if (ua.includes('Chrome')) return 'Chrome';
        if (ua.includes('Firefox')) return 'Firefox';
        if (ua.includes('Safari')) return 'Safari';
        if (ua.includes('Edge')) return 'Edge';
        if (ua.includes('MSIE') || ua.includes('Trident')) return 'IE';
        return 'Unknown';
    };
    
    const getOS = () => {
        if (ua.includes('Windows')) return 'Windows';
        if (ua.includes('Mac')) return 'MacOS';
        if (ua.includes('Linux')) return 'Linux';
        if (ua.includes('Android')) return 'Android';
        if (ua.includes('iOS') || ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
        return 'Unknown';
    };
    
    return {
        userAgent: ua,
        browser: getBrowser(),
        os: getOS(),
        isMobile: /Mobile|Android|iPhone|iPad|iPod/i.test(ua),
        isBot: /bot|crawler|spider|scraper/i.test(ua),
        browserVersion: ua.match(/(Chrome|Firefox|Safari|Edge)\/(\d+)/)?.[2] || 'unknown'
    };
}

// Detect screen orientation
export function detectOrientation() {
    if (window.screen.orientation) {
        return window.screen.orientation.type.includes('portrait') ? 'portrait' : 'landscape';
    }
    return window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';
}

// Check camera resolution adequacy
export function checkCameraResolution(width, height) {
    const minWidth = 640;
    const minHeight = 480;
    const recommendedWidth = 1280;
    const recommendedHeight = 720;
    
    if (!width || !height) {
        return {
            isAdequate: false,
            message: "Unable to detect camera resolution",
            width: width || 0,
            height: height || 0,
            meetsMinimum: false,
            meetsRecommended: false
        };
    }
    
    const meetsMinimum = width >= minWidth && height >= minHeight;
    const meetsRecommended = width >= recommendedWidth && height >= recommendedHeight;
    
    let message = "";
    if (meetsRecommended) {
        message = `Excellent! Camera resolution (${width}x${height}) meets recommended requirements`;
    } else if (meetsMinimum) {
        message = `Camera resolution (${width}x${height}) meets minimum requirements but ${recommendedWidth}x${recommendedHeight} is recommended`;
    } else {
        message = `Camera resolution (${width}x${height}) is below minimum requirement (${minWidth}x${minHeight})`;
    }
    
    return {
        isAdequate: meetsMinimum,
        meetsMinimum: meetsMinimum,
        meetsRecommended: meetsRecommended,
        width: width,
        height: height,
        message: message
    };
}

// Check microphone levels
export function checkMicrophoneLevels(level) {
    const minLevel = 10; // Minimum 10% volume
    const goodLevel = 30; // Good level 30%
    const excellentLevel = 60; // Excellent level 60%
    
    let status = "inadequate";
    let message = "";
    
    if (level >= excellentLevel) {
        status = "excellent";
        message = "Excellent microphone level detected";
    } else if (level >= goodLevel) {
        status = "good";
        message = "Good microphone level detected";
    } else if (level >= minLevel) {
        status = "adequate";
        message = "Microphone level is adequate but could be higher";
    } else {
        status = "inadequate";
        message = `Microphone level (${Math.round(level)}%) is below minimum required (${minLevel}%). Please check your microphone.`;
    }
    
    return {
        isAdequate: level >= minLevel,
        level: Math.round(level),
        status: status,
        message: message,
        minRequired: minLevel,
        currentLevel: Math.round(level)
    };
}

// Export all functions (already done with export keywords above)