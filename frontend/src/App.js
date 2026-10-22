import React, { useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, useLocation, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import ProctorDashboard from "./pages/ProctorDashboard";
import AthenaExamDashboard from "./pages/AthenaExamDashboard";
import Diagnostics from "./pages/Diagnostics";
import AdminMonitor from "./pages/AdminMonitor";
import { detectPhone, showPhoneWarning } from "./utils/deviceDetection";
import EyeTrackingWidget from "./components/EyeTrackingWidget";


function AppContent() {
  const [showBanner, setShowBanner] = useState(false);
  const [proctoringActive] = useState(true);
  const [lastViolation, setLastViolation] = useState(null);
  const location = useLocation();

  const [faceUser, setFaceUser] = useState(() => {
    const stored = localStorage.getItem("user");
    return stored ? JSON.parse(stored) : null;
  });

  useEffect(() => {
    const device = detectPhone();
    sessionStorage.setItem("deviceInfo", JSON.stringify(device));

    if (device.isPhone) {
      showPhoneWarning();
      setShowBanner(true);
    } else {
      setShowBanner(false);
    }
  }, [location]);

  useEffect(() => {
    const handleViolation = (event) => {
      const { violationType, timestamp } = event.detail || {};
      console.log('🚨 Proctoring violation event:', violationType, 'at', timestamp);
      setLastViolation({ type: violationType, time: timestamp });
    };

    window.addEventListener('proctoringViolation', handleViolation);

    return () => {
      window.removeEventListener('proctoringViolation', handleViolation);
    };
  }, []);

  const dismissBanner = () => {
    setShowBanner(false);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setFaceUser(null);
    window.location.href = "/";
  };

  const isAthenaExam = location.pathname === '/athena-exam' || location.pathname === '/exam';

  return (
    <>
      {/* Eye Tracking Widget on Exam & Proctor Dashboard */}
      {(location.pathname === '/proctor-dashboard') && (
        <EyeTrackingWidget />
      )}

      {/* Proctoring Status Dot Indicator (only on legacy pages if needed) */}
      {!isAthenaExam && (
        <div id="proctoringStatus" style={styles.proctoringStatus}>
          <div style={styles.statusDot}></div>
          <span>{proctoringActive ? 'Proctoring Active' : 'Proctoring Inactive'}</span>
          {lastViolation && (
            <span style={styles.violationBadge}>
              Last: {lastViolation.type}
            </span>
          )}
        </div>
      )}

      {/* Mobile Device Banner */}
      {showBanner && !isAthenaExam && (
        <div style={styles.warningBanner}>
          <div style={styles.bannerContent}>
            <span>⚠️ Mobile Device Detected! For the best proctoring experience, </span>
            <span>please use a desktop or laptop computer with a webcam.</span>
            <button onClick={dismissBanner} style={styles.dismissButton}>
              Dismiss
            </button>
          </div>
        </div>
      )}

      <div>
        <Routes>
          {/* Login & Auth Routes */}
          <Route path="/" element={<Login />} />
          <Route path="/login" element={<Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Student Registration Route */}
          <Route path="/register" element={<Register />} />

          {/* Student Dashboard */}
          <Route path="/dashboard" element={<Dashboard user={faceUser} onLogout={handleLogout} />} />
          <Route path="/student" element={<Dashboard user={faceUser} onLogout={handleLogout} />} />

          {/* Modern Proctoring Dashboard */}
          <Route
            path="/proctor-dashboard"
            element={<ProctorDashboard user={faceUser} onLogout={handleLogout} />}
          />

          {/* Athena AI Smart Proctoring Exam Dashboard */}
          <Route
            path="/exam"
            element={<AthenaExamDashboard />}
          />
          <Route
            path="/athena-exam"
            element={<AthenaExamDashboard />}
          />

          {/* Diagnostics Deployment Page */}
          <Route
            path="/diagnostics"
            element={<Diagnostics />}
          />

          {/* Admin Live Monitoring Section */}
          <Route
            path="/admin"
            element={<AdminMonitor />}
          />
          <Route
            path="/admin-monitor"
            element={<AdminMonitor />}
          />


          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

const styles = {
  warningBanner: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    textAlign: 'center',
    padding: '10px 16px',
    zIndex: 9999,
    fontWeight: 'bold',
    fontFamily: 'Inter, sans-serif',
    boxShadow: '0 2px 10px rgba(0,0,0,0.2)'
  },
  bannerContent: {
    maxWidth: '1200px',
    margin: '0 auto',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '15px',
    flexWrap: 'wrap',
    fontSize: '0.85rem'
  },
  dismissButton: {
    background: 'white',
    border: 'none',
    padding: '4px 12px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold',
    color: '#667eea'
  },
  proctoringStatus: {
    position: 'fixed',
    bottom: '20px',
    left: '20px',
    background: 'rgba(15,23,42,0.9)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: '#10b981',
    padding: '6px 14px',
    borderRadius: '20px',
    fontSize: '11px',
    fontFamily: 'monospace',
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backdropFilter: 'blur(8px)',
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
  },
  statusDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#10b981',
    boxShadow: '0 0 6px #10b981'
  },
  violationBadge: {
    background: 'rgba(239,68,68,0.8)',
    color: 'white',
    padding: '2px 8px',
    borderRadius: '10px',
    fontSize: '10px',
    marginLeft: '4px'
  }
};

export default App;