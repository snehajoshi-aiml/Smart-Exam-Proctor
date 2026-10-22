import React from 'react';

function CriticalAlertBox({ violationsCount, phoneDetected, multiFaceDetected }) {
  const isCritical = violationsCount >= 3 || phoneDetected || multiFaceDetected;

  if (!isCritical) return null;

  return (
    <div className="athena-critical-alert">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '4px' }}>
        <i className="fas fa-exclamation-triangle" style={{ fontSize: '1.2rem', color: '#ef4444' }}></i>
        <strong style={{ fontSize: '0.95rem', letterSpacing: '0.02em', color: '#ffffff' }}>
          CRITICAL: Multiple Violations Detected
        </strong>
      </div>
      <p style={{ fontSize: '0.78rem', color: '#fecaca', lineHeight: 1.4 }}>
        {phoneDetected
          ? 'Mobile phone detected in camera view!'
          : multiFaceDetected
          ? 'Multiple faces detected in examination environment!'
          : `Session flagged with ${violationsCount} security violations. Proctor has been notified.`}
      </p>
    </div>
  );
}

export default CriticalAlertBox;
