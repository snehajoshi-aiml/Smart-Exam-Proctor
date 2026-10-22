import React, { useEffect, useRef, useState } from "react";
import { 
  detectPhone, 
  canTakeExam, 
  showPersistentWarning, 
  startDeviceMonitoring, 
  hasRequiredFeatures,
  getDeviceInfoForLogging,
  redirectIfMobile,
  showPhoneWarning,
  usePhoneDetection
} from "../utils/deviceDetection";
import { getApiBaseUrl } from "../utils/config";

function Exam() {
  const videoRef = useRef(null);
  const audioContextRef = useRef(null);
  const [warning, setWarning] = useState("");
  const [isPhone, setIsPhone] = useState(false);
  const [examAllowed, setExamAllowed] = useState(true);
  const [deviceIssues, setDeviceIssues] = useState([]);
  const [orientation, setOrientation] = useState("");
  const [screenSize, setScreenSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [cameraStatus, setCameraStatus] = useState("checking");
  const [microphoneStatus, setMicrophoneStatus] = useState("checking");
  const [violations, setViolations] = useState([]);
  const [showPhoneWarning, setShowPhoneWarning] = useState(false);
  const [clientIP, setClientIP] = useState("unknown");

  // Helper function to get client IP
  const getClientIP = async () => {
    try {
      const response = await fetch("https://api.ipify.org?format=json");
      const data = await response.json();
      return data.ip;
    } catch (error) {
      console.error("Failed to get IP:", error);
      return "unknown";
    }
  };

  // Helper function to check screen size
  const checkScreenSize = () => {
    return {
      width: window.innerWidth,
      height: window.innerHeight,
      isMobile: window.innerWidth < 768
    };
  };

  // Helper function to detect orientation
  const detectOrientation = () => {
    return window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';
  };

  // Helper function to check camera resolution
  const checkCameraResolution = (width, height) => {
    const minWidth = 640;
    const minHeight = 480;
    
    if (!width || !height) {
      return {
        isAdequate: false,
        message: "Unable to detect camera resolution"
      };
    }
    
    return {
      isAdequate: width >= minWidth && height >= minHeight,
      message: width >= minWidth && height >= minHeight ? 
        "Camera resolution is adequate" : 
        `Camera resolution (${width}x${height}) is below minimum requirement`
    };
  };

  // Helper function to check microphone levels
  const checkMicrophoneLevels = (level) => {
    const minLevel = 10;
    return {
      isAdequate: level >= minLevel,
      level: Math.round(level)
    };
  };

  // Generate device fingerprint (simplified version)
  const getDeviceFingerprint = async () => {
    const fingerprint = {
      userAgent: navigator.userAgent,
      language: navigator.language,
      screenResolution: `${window.screen.width}x${window.screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      timestamp: Date.now()
    };
    
    const fingerprintString = JSON.stringify(fingerprint);
    const encoder = new TextEncoder();
    const data = encoder.encode(fingerprintString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    return { hash: hashHex, details: fingerprint };
  };

  // 📱 Comprehensive Phone Detection and Device Check
  useEffect(() => {
    const initializeDeviceCheck = async () => {
      try {
        // Get device fingerprint
        const fingerprint = await getDeviceFingerprint();
        
        // Detect phone and device type
        const device = detectPhone();
        setIsPhone(device.isPhone);
        
        // Check screen size
        const screen = checkScreenSize();
        setScreenSize(screen);
        
        // Check orientation
        const currentOrientation = detectOrientation();
        setOrientation(currentOrientation);
        
        // Enhanced phone detection with multiple methods
        const isMobileDevice = device.isPhone || 
                              device.deviceType === "tablet" ||
                              screen.isMobile ||
                              /Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        // Check if exam can be taken on this device
        const allowed = canTakeExam();
        if (!allowed || isMobileDevice) {
          setExamAllowed(false);
          setShowPhoneWarning(true);
          setWarning("❌ Mobile devices are strictly prohibited for this proctored exam. Please use a desktop/laptop computer with webcam and microphone.");
          
          // Log mobile device access attempt
          const ip = await getClientIP();
          const apiBase = getApiBaseUrl();
          await fetch(`${apiBase}/api/proctoring/violation`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "MOBILE_ACCESS_ATTEMPT",
              deviceInfo: device,
              screenSize: screen,
              orientation: currentOrientation,
              userAgent: navigator.userAgent,
              timestamp: new Date().toISOString(),
              ip: ip
            })
          }).catch(err => console.log("Violation logging failed:", err));
          
          return;
        }
        
        // Check required features
        const features = hasRequiredFeatures();
        if (!features.isAllowed) {
          setDeviceIssues(features.issues);
          setWarning(`Device compatibility issues: ${features.issues.join(", ")}`);
        }
        
        // Show persistent warning banner for mobile/tablet
        if (device.isPhone || device.deviceType === "tablet") {
          showPersistentWarning();
          setShowPhoneWarning(true);
        }
        
        // Get client IP
        const ip = await getClientIP();
        setClientIP(ip);
        
        // Log device info for security
        const deviceInfo = {
          ...device,
          fingerprint: fingerprint.hash,
          screenSize: screen,
          orientation: currentOrientation,
          examStarted: new Date().toISOString(),
          page: "Exam",
          ip: ip,
          browserPlugins: Array.from(navigator.plugins).map(p => p.name),
          languages: navigator.languages,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        };
        
        const apiBase = getApiBaseUrl();
        await fetch(`${apiBase}/api/log-device`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(deviceInfo)
        }).catch(err => console.log("Device logging failed:", err));
        
        // Start periodic phone detection checks
        const phoneDetectionInterval = setInterval(() => {
          const currentDevice = detectPhone();
          if (currentDevice.isPhone && !isPhone) {
            setExamAllowed(false);
            setWarning("❌ Exam terminated: Mobile device detected during exam.");
            
            // Log device change violation
            fetch(`${apiBase}/api/proctoring/violation`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                type: "MOBILE_DETECTED_DURING_EXAM",
                deviceInfo: currentDevice,
                timestamp: new Date().toISOString()
              })
            }).catch(err => console.log("Violation logging failed:", err));
          }
        }, 5000);
        
        return () => clearInterval(phoneDetectionInterval);
      } catch (error) {
        console.error("Device check initialization error:", error);
        setWarning("Error initializing device check. Please refresh the page.");
      }
    };
    
    initializeDeviceCheck();
  }, []);

  // 📷 Start Camera with Resolution and Microphone Checks
  useEffect(() => {
    if (!examAllowed) return;
    
    let streamRef = null;
    let micCheckInterval = null;
    
    // Check if webcam is available
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setWarning("❌ Camera access not supported on this device. Please use a desktop/laptop with webcam.");
      setCameraStatus("unsupported");
      return;
    }
    
    // Request high resolution for better proctoring
    navigator.mediaDevices.getUserMedia({ 
      video: { 
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: "user"
      }, 
      audio: true 
    })
      .then(async (stream) => {
        streamRef = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setCameraStatus("active");
        
        // Check camera resolution
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          const settings = videoTrack.getSettings();
          const resolutionCheck = checkCameraResolution(settings.width, settings.height);
          if (!resolutionCheck.isAdequate) {
            setDeviceIssues(prev => [...prev, resolutionCheck.message]);
          }
        }
        
        // Check microphone levels
        if (audioContextRef.current) {
          await audioContextRef.current.close();
        }
        
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        audioContextRef.current = audioContext;
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        source.connect(analyser);
        
        // Monitor microphone levels
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        micCheckInterval = setInterval(() => {
          analyser.getByteTimeDomainData(dataArray);
          let maxSample = 0;
          for (let i = 0; i < dataArray.length; i++) {
            const sample = Math.abs((dataArray[i] - 128) / 128);
            if (sample > maxSample) maxSample = sample;
          }
          
          const level = maxSample * 100;
          const micStatus = checkMicrophoneLevels(level);
          
          if (!micStatus.isAdequate && microphoneStatus === "active") {
            setMicrophoneStatus("low");
            setWarning("⚠️ Microphone level is low. Please check your microphone settings.");
          } else if (micStatus.isAdequate && microphoneStatus !== "active") {
            setMicrophoneStatus("active");
            if (warning.includes("Microphone level is low")) {
              setWarning("");
            }
          }
        }, 1000);
        
        // Resume audio context after user interaction
        if (audioContext.state === "suspended") {
          await audioContext.resume();
        }
      })
      .catch((err) => {
        console.error("Camera error:", err);
        setCameraStatus("error");
        if (err.name === "NotAllowedError") {
          setWarning("Camera/Mic access denied ❌ Please allow camera and microphone access for proctoring.");
        } else if (err.name === "NotFoundError") {
          setWarning("No camera found on this device ❌ Please connect a webcam.");
        } else {
          setWarning("Camera/Mic access error ❌ Please check your device settings.");
        }
      });
    
    // Cleanup function
    return () => {
      if (micCheckInterval) {
        clearInterval(micCheckInterval);
      }
      if (streamRef) {
        streamRef.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject = null;
      }
    };
  }, [examAllowed]);

  // 🚫 Tab Switch Detection
  useEffect(() => {
    if (!examAllowed) return;
    
    let tabSwitchCount = 0;
    const MAX_TAB_SWITCHES = 3;
    
    const handleVisibility = () => {
      if (document.hidden) {
        tabSwitchCount++;
        setViolations(prev => [...prev, { type: "TAB_SWITCH", timestamp: new Date() }]);
        setWarning(`⚠️ Tab switched! (${tabSwitchCount}/${MAX_TAB_SWITCHES}) This is not allowed. Exam may be terminated.`);
        
        const apiBase = getApiBaseUrl();
        // Log tab switch for proctoring
        fetch(`${apiBase}/api/proctoring/violation`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "TAB_SWITCH",
            count: tabSwitchCount,
            timestamp: new Date().toISOString()
          })
        }).catch(err => console.log("Violation logging failed:", err));
        
        // Terminate exam after max tab switches
        if (tabSwitchCount >= MAX_TAB_SWITCHES) {
          setExamAllowed(false);
          setWarning("❌ Exam terminated: Maximum tab switches exceeded.");
          
          fetch(`${apiBase}/api/proctoring/terminate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              reason: "MAX_TAB_SWITCHES_EXCEEDED",
              count: tabSwitchCount,
              timestamp: new Date().toISOString()
            })
          }).catch(err => console.log("Termination logging failed:", err));
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [examAllowed]);

  // 📱 Real-time device monitoring
  useEffect(() => {
    if (!examAllowed) return;
    
    let stopMonitoring = null;
    
    try {
      stopMonitoring = startDeviceMonitoring((event) => {
        console.log("Device monitoring alert:", event);
        
        if (event.type === "DEVICE_CHANGED") {
          setViolations(prev => [...prev, { type: "DEVICE_CHANGED", details: event, timestamp: new Date() }]);
          setWarning(`⚠️ Device change detected! ${event.previous?.deviceType || "unknown"} to ${event.current?.deviceType || "unknown"}. This violates exam rules.`);
          
          const apiBase = getApiBaseUrl();
          // Log device change
          fetch(`${apiBase}/api/proctoring/violation`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "DEVICE_CHANGED",
              details: event,
              timestamp: new Date().toISOString()
            })
          }).catch(err => console.log("Violation logging failed:", err));
          
          // If changed to phone, restrict exam
          if (event.current?.isPhone) {
            setExamAllowed(false);
            setWarning("❌ Exam terminated: Mobile device detected during exam.");
          }
        }
      });
    } catch (error) {
      console.error("Failed to start device monitoring:", error);
    }
    
    return () => {
      if (stopMonitoring && typeof stopMonitoring === 'function') {
        stopMonitoring();
      }
    };
  }, [examAllowed]);

  // 📱 Orientation change detection
  useEffect(() => {
    if (!examAllowed) return;
    
    const handleOrientationChange = () => {
      const newOrientation = detectOrientation();
      setOrientation(newOrientation);
      
      const apiBase = getApiBaseUrl();
      // Log orientation change
      fetch(`${apiBase}/api/proctoring/event`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "ORIENTATION_CHANGE",
          orientation: newOrientation,
          timestamp: new Date().toISOString()
        })
      }).catch(err => console.log("Event logging failed:", err));
    };
    
    window.addEventListener("orientationchange", handleOrientationChange);
    window.addEventListener("resize", handleOrientationChange);
    
    return () => {
      window.removeEventListener("orientationchange", handleOrientationChange);
      window.removeEventListener("resize", handleOrientationChange);
    };
  }, [examAllowed]);

  // ⛔ Right click disable and keyboard shortcuts
  useEffect(() => {
    const handleContextMenu = (e) => {
      e.preventDefault();
      setViolations(prev => [...prev, { type: "RIGHT_CLICK", timestamp: new Date() }]);
      
      const apiBase = getApiBaseUrl();
      fetch(`${apiBase}/api/proctoring/violation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "RIGHT_CLICK",
          timestamp: new Date().toISOString()
        })
      }).catch(err => console.log("Violation logging failed:", err));
      
      return false;
    };
    
    const handleKeyDown = (e) => {
      if (e.key === "F12" || 
          (e.ctrlKey && e.shiftKey && (e.key === "I" || e.key === "J" || e.key === "C")) ||
          (e.ctrlKey && e.key === "U")) {
        e.preventDefault();
        setViolations(prev => [...prev, { type: "DEV_TOOLS_ATTEMPT", timestamp: new Date() }]);
        
        const apiBase = getApiBaseUrl();
        fetch(`${apiBase}/api/proctoring/violation`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "DEV_TOOLS_ATTEMPT",
            key: e.key,
            timestamp: new Date().toISOString()
          })
        }).catch(err => console.log("Violation logging failed:", err));
        
        return false;
      }
      
      if ((e.ctrlKey && (e.key === "c" || e.key === "v" || e.key === "x")) ||
          (e.metaKey && (e.key === "c" || e.key === "v" || e.key === "x"))) {
        e.preventDefault();
        return false;
      }
    };
    
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("keydown", handleKeyDown);
    
    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // 🚪 Handle page refresh/close warnings
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (examAllowed) {
        e.preventDefault();
        e.returnValue = "Exam in progress! Are you sure you want to leave? This will be recorded as a violation.";
        return e.returnValue;
      }
    };
    
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [examAllowed]);

  // If exam not allowed due to device
  if (!examAllowed) {
    return (
      <div style={{ 
        textAlign: "center", 
        marginTop: "50px",
        padding: "20px",
        backgroundColor: "#ffebee",
        borderRadius: "10px",
        maxWidth: "500px",
        margin: "50px auto"
      }}>
        <h1 style={{ color: "#d32f2f" }}>❌ Access Denied</h1>
        <h3 style={{ color: "#c62828" }}>{warning}</h3>
        <p style={{ marginTop: "20px" }}>
          Please use a desktop or laptop computer with:
        </p>
        <ul style={{ textAlign: "left", display: "inline-block" }}>
          <li>Webcam access (minimum 720p resolution)</li>
          <li>Microphone access</li>
          <li>Stable internet connection</li>
          <li>Chrome, Firefox, or Edge browser (latest version)</li>
          <li>Screen resolution of at least 1024x768</li>
        </ul>
        <br />
        <button 
          onClick={() => window.location.href = "/dashboard"}
          style={{
            marginTop: "20px",
            padding: "10px 20px",
            backgroundColor: "#4CAF50",
            color: "white",
            border: "none",
            borderRadius: "5px",
            cursor: "pointer"
          }}
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div style={{ textAlign: "center", marginTop: "20px" }}>
      <h1>📝 Smart Proctoring Exam</h1>
      
      {/* Enhanced Phone Warning Banner */}
      {showPhoneWarning && (
        <div style={{
          backgroundColor: "#ff9800",
          color: "white",
          padding: "15px",
          borderRadius: "5px",
          margin: "10px auto",
          maxWidth: "80%",
          animation: "pulse 2s infinite"
        }}>
          ⚠️ <strong>Mobile Device Detected!</strong> For valid proctoring, please use a desktop/laptop with webcam.
          <br />
          <small>Your exam activity is being monitored. Using a mobile device may result in disqualification.</small>
        </div>
      )}
      
      {/* Device issues warning */}
      {deviceIssues.length > 0 && (
        <div style={{
          backgroundColor: "#f44336",
          color: "white",
          padding: "10px",
          borderRadius: "5px",
          margin: "10px auto",
          maxWidth: "80%"
        }}>
          ⚠️ <strong>Device Issues:</strong> {deviceIssues.join(", ")}
        </div>
      )}
      
      {/* Main warning message */}
      {warning && (
        <h3 style={{ color: "red", backgroundColor: "#ffebee", padding: "10px", borderRadius: "5px" }}>
          {warning}
        </h3>
      )}
      
      {/* Device Status Dashboard */}
      <div style={{
        display: "flex",
        justifyContent: "center",
        gap: "20px",
        margin: "20px",
        flexWrap: "wrap"
      }}>
        <div style={{
          padding: "10px",
          backgroundColor: cameraStatus === "active" ? "#4CAF50" : cameraStatus === "checking" ? "#ff9800" : "#f44336",
          color: "white",
          borderRadius: "5px"
        }}>
          📷 Camera: {cameraStatus === "active" ? "Active ✓" : cameraStatus === "checking" ? "Checking..." : "Error ✗"}
        </div>
        <div style={{
          padding: "10px",
          backgroundColor: microphoneStatus === "active" ? "#4CAF50" : microphoneStatus === "low" ? "#ff9800" : "#f44336",
          color: "white",
          borderRadius: "5px"
        }}>
          🎤 Microphone: {microphoneStatus === "active" ? "Active ✓" : microphoneStatus === "low" ? "Low Level ⚠️" : microphoneStatus === "checking" ? "Checking..." : "Error ✗"}
        </div>
        <div style={{
          padding: "10px",
          backgroundColor: isPhone ? "#ff9800" : "#4CAF50",
          color: "white",
          borderRadius: "5px"
        }}>
          📱 Device: {isPhone ? "Mobile ⚠️" : "Desktop ✓"}
        </div>
        <div style={{
          padding: "10px",
          backgroundColor: "#2196F3",
          color: "white",
          borderRadius: "5px"
        }}>
          🖥️ Screen: {screenSize.width}x{screenSize.height}
        </div>
      </div>

      {/* Video Feed */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          width: "100%",
          maxWidth: "640px",
          height: "auto",
          border: "3px solid #4CAF50",
          marginTop: "20px",
          borderRadius: "10px",
          backgroundColor: "#000"
        }}
      />

      {/* Exam Information */}
      <div style={{ marginTop: "20px", padding: "20px", backgroundColor: "#f5f5f5", borderRadius: "10px", maxWidth: "600px", margin: "20px auto" }}>
        <h3>📋 Proctoring Status</h3>
        <p>📷 Live Camera Monitoring Active</p>
        <p>🎤 Audio Monitoring Active</p>
        <p>🚫 Tab switching is monitored (Max 3 violations)</p>
        <p>📱 Device changes are monitored</p>
        <p>⌨️ Keyboard shortcuts are disabled</p>
        <p>🖱️ Right-click is disabled</p>
        {isPhone && (
          <p style={{ color: "orange", fontWeight: "bold" }}>⚠️ Using mobile device may affect proctoring quality and result in disqualification</p>
        )}
        {violations.length > 0 && (
          <p style={{ color: "red" }}>⚠️ Violations recorded: {violations.length}</p>
        )}
      </div>
      
      {/* Submit Button */}
      <button
        onClick={() => {
          if (window.confirm("Are you sure you want to submit the exam? This action cannot be undone.")) {
            // Stop monitoring and submit
            if (audioContextRef.current) {
              audioContextRef.current.close();
            }
            if (videoRef.current && videoRef.current.srcObject) {
              videoRef.current.srcObject.getTracks().forEach(track => track.stop());
              videoRef.current.srcObject = null;
            }
            window.location.href = "/dashboard";
          }
        }}
        style={{
          marginTop: "20px",
          marginBottom: "40px",
          padding: "12px 40px",
          backgroundColor: "#4CAF50",
          color: "white",
          border: "none",
          borderRadius: "5px",
          cursor: "pointer",
          fontSize: "16px",
          fontWeight: "bold"
        }}
      >
        Submit Exam
      </button>
      
      <style>{`
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.8; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

export default Exam;