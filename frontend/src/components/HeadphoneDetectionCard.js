import React from 'react';

export default function HeadphoneDetectionCard({ headphoneState }) {
  const isDetected = headphoneState?.detected || false;
  const confidence = headphoneState?.confidence || 0;
  const detectedDevice = headphoneState?.label || 'Headphones / Earbuds';
  const screenshot = headphoneState?.screenshot;

  return (
    <div className={`proctor-card ${isDetected ? 'alert-pulse' : ''}`} style={{
      borderColor: isDetected ? 'var(--warning)' : 'var(--border-light)',
      background: isDetected ? 'var(--warning-bg)' : 'var(--bg-card)'
    }}>
      <div className="card-title">
        <span className="card-title-icon">🎧</span>
        <span>Headphones / Earbuds Detection</span>
        <span className={`badge ${isDetected ? 'badge-warning' : 'badge-success'}`} style={{ marginLeft: 'auto' }}>
          {isDetected ? 'HEADSETS DETECTED' : 'CLEAR'}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', margin: '14px 0' }}>
        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px 14px', borderRadius: 'var(--radius-sm)' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Earpiece Status</div>
          <div style={{ fontSize: '0.9rem', fontWeight: 700, color: isDetected ? 'var(--warning)' : 'var(--success)' }}>
            {isDetected ? `⚠️ ${detectedDevice}` : '✅ Ears Unobstructed'}
          </div>
        </div>

        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px 14px', borderRadius: 'var(--radius-sm)' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Confidence</div>
          <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {isDetected ? `${(confidence * 100).toFixed(1)}%` : '0%'}
          </div>
        </div>
      </div>

      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        Monitored: Headphones, AirPods, Neckbands, Bluetooth Headsets
      </div>

      {screenshot && (
        <div style={{ marginTop: '12px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Evidence Screenshot:</div>
          <img
            src={screenshot}
            alt="Evidence"
            style={{ width: '100%', height: '90px', objectFit: 'cover', borderRadius: 'var(--radius-sm)', border: '1px solid var(--warning-border)' }}
          />
        </div>
      )}
    </div>
  );
}
