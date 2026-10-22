import React, { useState, useEffect, useRef, useCallback } from 'react';
import Sidebar from '../components/Sidebar';
import WebcamFeed from '../components/WebcamFeed';
import FaceVerificationStatus from '../components/FaceVerificationStatus';
import PhoneDetectionCard from '../components/PhoneDetectionCard';
import ViolationHistory from '../components/ViolationHistory';
import NotificationToast from '../components/NotificationToast';


import { useContinuousVerification } from '../hooks/useContinuousVerification';
import { useObjectDetection } from '../hooks/useObjectDetection';
import { useSecurityControls } from '../hooks/useSecurityControls';
import { getSocket, joinStudentRoom } from '../services/socketService';
import { getApiBaseUrl } from '../utils/config';

export default function ProctorDashboard({ user, onLogout }) {
  const webcamRef = useRef(null);

  const [student] = useState(() => {
    if (user) return user;
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : { studentId: 'STU_' + Date.now(), name: 'Student', email: 'student@proctor.com' };
  });

  const [token] = useState(() => localStorage.getItem('token') || '');
  const [sessionId] = useState(`sess_${Date.now()}`);
  const [isMonitoring, setIsMonitoring] = useState(true);
  const [violations, setViolations] = useState([]);
  const [notifications, setNotifications] = useState([]);





  // Socket.IO real-time connection
  useEffect(() => {
    if (!student?.studentId) return;

    const socket = getSocket();
    joinStudentRoom(student.studentId);

    const handleSocketViolation = (v) => {
      console.log('🔌 Socket violation received:', v);
      setNotifications((prev) => [
        {
          id: Date.now(),
          title: `Violation: ${(v.type || 'Alert').toUpperCase()}`,
          message: v.description || v.message || 'Suspicious activity detected',
          severity: v.severity === 'high' ? 'danger' : 'warning',
          timestamp: v.timestamp || new Date().toISOString()
        },
        ...prev.slice(0, 4)
      ]);
    };

    socket.on('violation', handleSocketViolation);

    return () => {
      socket.off('violation', handleSocketViolation);
    };
  }, [student]);

  // Violation logging handler
  const handleViolation = useCallback(async (v) => {
    console.log('🚨 Violation logged:', v);

    // Update local state
    setViolations((prev) => [v, ...prev]);

    // Show toast notification
    setNotifications((prev) => [
      {
        id: Date.now(),
        title: `Security Alert: ${v.type.replace(/_/g, ' ').toUpperCase()}`,
        message: v.description || 'Violation recorded',
        severity: v.severity === 'high' ? 'danger' : 'warning',
        timestamp: v.timestamp
      },
      ...prev.slice(0, 4)
    ]);

    // Send violation to backend API
    try {
      if (token) {
        const apiBase = getApiBaseUrl();
        await fetch(`${apiBase}/api/violations/log`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            studentId: student.studentId,
            sessionId,
            type: v.type,
            confidence: v.confidence || null,
            description: v.description,
            screenshotBase64: v.screenshotBase64 || null,
            severity: v.severity || 'medium'
          })
        });
      }
    } catch (err) {
      console.error('Failed to log violation to backend:', err);
    }
  }, [student, sessionId, token]);

  // Custom Hooks
  const verificationResult = useContinuousVerification({
    webcamRef,
    studentId: student.studentId,
    token,
    isActive: isMonitoring,
    intervalMs: 3000,
    onViolation: handleViolation
  });

  const { phoneState } = useObjectDetection({
    webcamRef,
    token,
    isActive: isMonitoring,
    intervalMs: 3500,
    onPhoneDetected: handleViolation
  });

  useSecurityControls({
    isActive: isMonitoring,
    onViolation: handleViolation
  });

  const handleDismissNotification = (id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  return (
    <div className="proctor-layout">
      {/* Sidebar Navigation */}
      <Sidebar user={student} onLogout={onLogout} />

      {/* Main Content Area */}
      <div className="proctor-main">
        {/* Header */}
        <header className="proctor-header">
          <div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Proctoring Live Command Dashboard</h1>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Real-time monitoring session: <span style={{ color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}>{sessionId}</span>
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <span className={`badge ${isMonitoring ? 'badge-success' : 'badge-danger'}`}>
              {isMonitoring ? '🟢 LIVE MONITORING' : '🔴 PAUSED'}
            </span>

            <button
              onClick={() => setIsMonitoring(!isMonitoring)}
              className={`btn-proctor ${isMonitoring ? 'btn-danger' : 'btn-primary'}`}
              style={{ fontSize: '0.85rem', padding: '8px 16px' }}
            >
              {isMonitoring ? '⏸️ Pause Monitoring' : '▶️ Resume Monitoring'}
            </button>
          </div>
        </header>

        {/* Dashboard Grid Content */}
        <div className="proctor-content">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px' }}>
            {/* Left Column - Video Feed & Detections */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Live Webcam Section */}
              <div className="proctor-card" style={{ padding: '16px' }}>
                <div className="card-title">
                  <span className="card-title-icon">📷</span>
                  <span>AI Proctoring Sentinel Feed</span>
                  <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    640x480 | 30 FPS
                  </span>
                </div>

                <WebcamFeed
                  webcamRef={webcamRef}
                  isActive={isMonitoring}
                  faceStatus={verificationResult?.status}
                />
              </div>

              {/* Status Cards Grid */}
              <div className="dashboard-grid" style={{ marginBottom: 0 }}>
                {/* Face Verification Card */}
                <FaceVerificationStatus
                  verificationResult={verificationResult}
                  sessionActive={isMonitoring}
                  violationCount={violations.filter((v) => v.type === 'face_mismatch' || v.type === 'no_face').length}
                />

                {/* Phone Detection Card */}
                <PhoneDetectionCard
                  phoneState={phoneState}
                  violationCount={violations.filter((v) => v.type === 'phone_detected').length}
                />

                {/* ArcFace & Telemetry Card */}
                <div style={{
                  background: 'rgba(15,23,42,0.8)',
                  borderRadius: '1rem',
                  border: '1px solid #6366f1',
                  padding: '1rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '1.2rem' }}>🎯</span>
                    <div>
                      <div style={{ color: '#e2e8f0', fontWeight: 600, fontSize: '0.9rem' }}>ArcFace & Pose Engine</div>
                      <div style={{ fontSize: '0.75rem', color: '#10b981' }}>Cosine Similarity Active</div>
                    </div>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', background: 'rgba(30,41,59,0.6)', padding: '8px', borderRadius: '8px' }}>
                    SolvePnP Yaw/Pitch/Roll & MediaPipe Eye Gaze monitored continuously on video overlay.
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Violation History & Real-Time Logs */}
            <div>
              <ViolationHistory violations={violations} />
            </div>
          </div>
        </div>
      </div>

      {/* Real-time Toast Notifications */}
      <NotificationToast
        notifications={notifications}
        onDismiss={handleDismissNotification}
      />


    </div>
  );
}
