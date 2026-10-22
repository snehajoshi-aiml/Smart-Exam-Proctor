import React, { useEffect, useRef } from 'react';

function ActivityLogPanel({ logs }) {
  const logContainerRef = useRef(null);

  // Auto-scroll to latest log entry
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div style={{ background: '#090d1a', border: '1px solid #1e293b', borderRadius: '16px', padding: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <h4 style={{ fontSize: '0.82rem', fontWeight: 700, color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <i className="fas fa-terminal" style={{ color: '#818cf8' }}></i>
          Proctor Activity Terminal Log
        </h4>
        <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#f87171', background: 'rgba(239, 68, 68, 0.15)', padding: '2px 8px', borderRadius: '10px', border: '1px solid rgba(239,68,68,0.3)' }}>
          Steps 9 & 10: Alert & Flag
        </span>
      </div>

      {/* Terminal Log Container */}
      <div className="athena-log-panel" ref={logContainerRef}>
        {logs.length === 0 ? (
          <div style={{ color: '#64748b', fontStyle: 'italic', textAlign: 'center', padding: '10px' }}>
            No security violations recorded. System operating normally.
          </div>
        ) : (
          logs.map((log) => {
            let textColor = '#cbd5e1';
            let icon = 'fa-info-circle';
            if (log.type === 'critical' || log.type === 'danger') {
              textColor = '#fca5a5';
              icon = 'fa-exclamation-triangle';
            } else if (log.type === 'warning') {
              textColor = '#fbbf24';
              icon = 'fa-exclamation-circle';
            } else if (log.type === 'info') {
              textColor = '#93c5fd';
              icon = 'fa-check-circle';
            }

            return (
              <div key={log.id} className="athena-log-item">
                <span className="athena-log-time">[{log.time}]</span>
                <span style={{ color: textColor }}>
                  <i className={`fas ${icon}`} style={{ marginRight: '6px', fontSize: '0.72rem' }}></i>
                  {log.message}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default ActivityLogPanel;
