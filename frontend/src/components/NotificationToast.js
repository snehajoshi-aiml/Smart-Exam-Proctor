import React from 'react';

export default function NotificationToast({ notifications = [], onDismiss }) {
  if (!notifications || notifications.length === 0) return null;

  return (
    <div className="toast-container">
      {notifications.map((n) => (
        <div
          key={n.id}
          className={`toast-item ${n.severity || 'warning'}`}
        >
          <span style={{ fontSize: '1.3rem' }}>
            {n.severity === 'danger' ? '🚨' : n.severity === 'warning' ? '⚠️' : 'ℹ️'}
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{n.title || 'Proctoring Alert'}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              {n.message}
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              {new Date(n.timestamp || Date.now()).toLocaleTimeString()}
            </div>
          </div>
          {onDismiss && (
            <button
              onClick={() => onDismiss(n.id)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '1rem',
                padding: '0 4px'
              }}
            >
              ✕
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
