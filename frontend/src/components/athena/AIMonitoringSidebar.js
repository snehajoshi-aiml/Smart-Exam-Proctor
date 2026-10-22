import React from 'react';
import WebcamFeed from './WebcamFeed';
import AudioWaveMeter from './AudioWaveMeter';
import StatusBadgeCard from './StatusBadgeCard';
import CriticalAlertBox from './CriticalAlertBox';
import ActivityLogPanel from './ActivityLogPanel';
import AttentionStatusCard from './AttentionStatusCard';

function AIMonitoringSidebar({
  isProctoringActive,
  eyeTrackingState,
  faceDetectionState,
  phoneDetectionState,
  attentionState,
  headPoseState,
  tabSwitchesCount,
  maxTabSwitches = 3,
  multiFaceWarningsCount = 0,
  violationsCount,
  voiceDetected,
  logs,
  phoneDetected,
  multiFaceDetected,
  onDetectionUpdate,
  onViolationTriggered,
  onVoiceStatusChange,
  onVoiceViolationTriggered,
  identityVerification
}) {
  const getTabSwitchStatus = () => {
    if (tabSwitchesCount === 0) return 'green';
    if (tabSwitchesCount < maxTabSwitches) return 'orange';
    return 'red';
  };

  const getViolationStatus = () => {
    if (violationsCount === 0) return 'green';
    if (violationsCount < 3) return 'orange';
    return 'red';
  };

  return (
    <aside className="athena-right-panel">
      {/* Workflow Steps 7 & 8 Badge */}
      <div style={{
        background: 'rgba(99, 102, 241, 0.12)',
        border: '1px solid rgba(99, 102, 241, 0.35)',
        borderRadius: '12px',
        padding: '8px 12px',
        marginBottom: '14px',
        fontSize: '0.75rem',
        fontWeight: 700,
        color: '#818cf8',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <span>🔄 Steps 7 & 8 of 12</span>
        <span style={{ color: '#cbd5e1', fontWeight: 600 }}>Real-Time AI Monitoring Engine</span>
      </div>

      {/* 1. Live Camera Sentinel Card */}
      <div className="athena-sidebar-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fas fa-video" style={{ color: '#818cf8' }}></i>
            LIVE CAMERA SENTINEL
          </h3>
          <span style={{
            fontSize: '0.72rem',
            fontWeight: 700,
            color: '#34d399',
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid #10b981',
            padding: '2px 8px',
            borderRadius: '12px'
          }}>
            AI SENTINEL ACTIVE
          </span>
        </div>

        {/* Live Webcam & Canvas Overlay */}
        <WebcamFeed
          isProctoringActive={isProctoringActive}
          onDetectionUpdate={onDetectionUpdate}
          onViolationTriggered={onViolationTriggered}
          identityVerification={identityVerification}
        />
      </div>

      {/* 2. Modern Audio Telemetry Card */}
      <AudioWaveMeter
        voiceDetected={voiceDetected}
        onVoiceStatusChange={onVoiceStatusChange}
        onVoiceViolationTriggered={onVoiceViolationTriggered}
      />

      {/* 3. AI Biometric Telemetry Cards Stack */}
      <div className="athena-sidebar-card">
        <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#cbd5e1', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <i className="fas fa-microchip" style={{ color: '#60a5fa' }}></i>
          REAL-TIME TELEMETRY METRICS
        </h4>

        {/* Face Status Card */}
        <StatusBadgeCard
          icon="fas fa-user-check"
          label="FACE STATUS"
          value={faceDetectionState.value}
          status={faceDetectionState.status}
          detail={faceDetectionState.detail}
        />

        {/* Eye Tracking Card */}
        <StatusBadgeCard
          icon="fas fa-eye"
          label="EYE TRACKING"
          value={eyeTrackingState.value}
          status={eyeTrackingState.status}
          detail={eyeTrackingState.detail}
        />

        {/* Attention Sentinel Card */}
        <AttentionStatusCard attentionState={attentionState} />

        {/* Phone Detection Card */}
        <StatusBadgeCard
          icon="fas fa-mobile-alt"
          label="PHONE DETECTOR"
          value={phoneDetectionState.value}
          status={phoneDetectionState.status}
        />

        {/* Multi-Face Warning Counter Card (Requirement 8) */}
        <StatusBadgeCard
          icon="fas fa-users-slash"
          label="MULTI-FACE WARNINGS"
          value={multiFaceWarningsCount >= 3 ? "Exam Terminated" : `Warnings: ${multiFaceWarningsCount} / 3`}
          status={multiFaceWarningsCount === 0 ? "green" : multiFaceWarningsCount < 3 ? "orange" : "red"}
          detail={multiFaceWarningsCount >= 3 ? "3 Confirmed Violations" : "Max 3 warnings before termination"}
        />

        {/* Tab Switch Counter Card */}
        <StatusBadgeCard
          icon="fas fa-window-restore"
          label="TAB SWITCHES"
          value={`Switches: ${tabSwitchesCount}/${maxTabSwitches}`}
          status={getTabSwitchStatus()}
        />

        {/* Violations Counter Card */}
        <StatusBadgeCard
          icon="fas fa-shield-alt"
          label="TOTAL VIOLATIONS"
          value={`Violations: ${violationsCount}`}
          status={getViolationStatus()}
        />
      </div>

      {/* 4. Critical Alert Box */}
      <CriticalAlertBox
        violationsCount={violationsCount}
        phoneDetected={phoneDetected}
        multiFaceDetected={multiFaceDetected}
      />

      {/* 5. Terminal Activity Log Panel */}
      <ActivityLogPanel logs={logs} />
    </aside>
  );
}

export default AIMonitoringSidebar;
