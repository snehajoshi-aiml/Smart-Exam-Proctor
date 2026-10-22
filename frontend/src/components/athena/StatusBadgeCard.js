import React from 'react';

function StatusBadgeCard({ icon, label, value, status = 'green', detail }) {
  return (
    <div className="athena-status-card">
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <i className={icon} style={{
          fontSize: '1rem',
          color: status === 'red' ? '#ef4444' : status === 'orange' ? '#f59e0b' : '#10b981'
        }}></i>
        <div>
          <span style={{ fontSize: '0.84rem', fontWeight: 600, color: '#f8fafc', display: 'block' }}>
            {label}
          </span>
          {detail && (
            <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
              {detail}
            </span>
          )}
        </div>
      </div>

      <span className={`athena-status-badge ${status}`}>
        {value}
      </span>
    </div>
  );
}

export default StatusBadgeCard;
