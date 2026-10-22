import React from 'react';

export default function PhoneDetectionCard({ phoneState, violationCount = 0 }) {
  const isDetected = phoneState?.detected || false;
  const confidence = phoneState?.confidence || 0;
  const lastDetectionTime = phoneState?.lastDetectionTime;
  const modelUsed = phoneState?.model || 'YOLOv8n / COCO-SSD';

  return (
    <div className={`proctor-card ${isDetected ? 'alert-pulse' : ''}`} style={{
      borderColor: isDetected ? 'var(--danger)' : 'var(--border-light)',
      background: isDetected ? 'var(--danger-bg)' : 'var(--bg-card)'
    }}>
      <div className="card-title">
        <span className="card-title-icon">📱</span>
        <span>Phone Detection (YOLOv8)</span>
        <span className={`badge ${isDetected ? 'badge-danger' : 'badge-success'}`} style={{ marginLeft: 'auto' }}>
          {isDetected ? 'PHONE DETECTED' : 'CLEAR'}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', margin: '14px 0' }}>
        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px 14px', borderRadius: 'var(--radius-sm)' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Status</div>
          <div style={{ fontSize: '0.95rem', fontWeight: 700, color: isDetected ? 'var(--danger)' : 'var(--success)' }}>
            {isDetected ? '⚠️ Active Phone Violation' : '✅ No Devices Detected'}
          </div>
        </div>

        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px 14px', borderRadius: 'var(--radius-sm)' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Confidence</div>
          <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {isDetected ? `${(confidence * 100).toFixed(1)}%` : '0%'}
          </div>
        </div>
      </div>

      {/* Confidence Bar */}
      <div style={{ margin: '10px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
          <span>Detection Confidence Threshold (35%)</span>
          <span>{(confidence * 100).toFixed(0)}%</span>
        </div>
        <div style={{ height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '999px', overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${Math.min(100, confidence * 100)}%`,
            background: isDetected ? 'var(--danger)' : 'var(--primary)',
            borderRadius: '999px',
            transition: 'width 0.4s ease'
          }} />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '12px' }}>
        <span>Engine: <strong style={{ color: 'var(--text-secondary)' }}>{modelUsed}</strong></span>
        {lastDetectionTime && (
          <span>Last detected: {new Date(lastDetectionTime).toLocaleTimeString()}</span>
        )}
      </div>
    </div>
  );
}
