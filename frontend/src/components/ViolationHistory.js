import React, { useState } from 'react';

const TYPE_ICONS = {
  phone_detected: '📱',
  headphone_detected: '🎧',
  face_mismatch: '❌',
  no_face: '👤',
  multiple_faces: '👥',
  tab_switch: '🪟',
  copy_paste_attempt: '📋',
  right_click: '🖱️',
  dev_tools: '🛠️',
  screen_share: '🖥️',
  fullscreen_exit: '🖥️',
  looking_away: '👀',
  eye_movement: '👁️',
  info: 'ℹ️'
};

const SEVERITY_BADGES = {
  high: 'badge-danger',
  critical: 'badge-danger',
  medium: 'badge-warning',
  low: 'badge-info'
};

export default function ViolationHistory({ violations = [] }) {
  const [selectedScreenshot, setSelectedScreenshot] = useState(null);

  return (
    <div className="proctor-card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="card-title">
        <span className="card-title-icon">📜</span>
        <span>Violation & Proctoring History</span>
        <span className="badge badge-info" style={{ marginLeft: 'auto' }}>
          {violations.length} LOGS
        </span>
      </div>

      <div style={{
        flex: 1,
        overflowY: 'auto',
        maxHeight: '420px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        paddingRight: '4px'
      }}>
        {violations.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '40px 20px',
            color: 'var(--text-muted)',
            fontSize: '0.9rem'
          }}>
            ✅ No violations logged in this session.
          </div>
        ) : (
          violations.map((v, index) => {
            const icon = TYPE_ICONS[v.type || v.violationType] || '⚠️';
            const badgeClass = SEVERITY_BADGES[v.severity] || 'badge-warning';
            const timestamp = v.timestamp ? new Date(v.timestamp).toLocaleTimeString() : 'N/A';

            return (
              <div
                key={v.id || v._id || index}
                style={{
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid var(--border-light)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  transition: 'background 0.2s'
                }}
              >
                <span style={{ fontSize: '1.4rem' }}>{icon}</span>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                      {(v.type || v.violationType || 'Violation').replace(/_/g, ' ').toUpperCase()}
                    </span>
                    <span className={`badge ${badgeClass}`} style={{ fontSize: '0.65rem', padding: '2px 8px' }}>
                      {v.severity || 'medium'}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {v.description || v.message || (typeof v.details === 'string' ? v.details : v.details?.message) || 'Violation triggered'}
                  </div>
                </div>

                <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{timestamp}</span>
                  {(v.screenshotBase64 || v.screenshot) && (
                    <button
                      onClick={() => setSelectedScreenshot(v.screenshotBase64 || v.screenshot)}
                      style={{
                        background: 'rgba(99,102,241,0.2)',
                        border: '1px solid rgba(99,102,241,0.4)',
                        color: 'var(--primary)',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '0.7rem',
                        cursor: 'pointer'
                      }}
                    >
                      📸 View Snapshot
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Screenshot Modal */}
      {selectedScreenshot && (
        <div
          onClick={() => setSelectedScreenshot(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            zIndex: 10001,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
        >
          <div style={{ position: 'relative', maxWidth: '640px', width: '100%' }} onClick={(e) => e.stopPropagation()}>
            <img
              src={selectedScreenshot}
              alt="Violation Evidence"
              style={{ width: '100%', borderRadius: 'var(--radius-md)', border: '2px solid var(--primary)' }}
            />
            <button
              onClick={() => setSelectedScreenshot(null)}
              style={{
                position: 'absolute',
                top: '-12px',
                right: '-12px',
                background: 'var(--danger)',
                color: 'white',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                fontSize: '1rem',
                cursor: 'pointer',
                fontWeight: 700
              }}
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
