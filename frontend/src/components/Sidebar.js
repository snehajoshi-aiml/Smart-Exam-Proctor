import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export default function Sidebar({ user, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { label: 'Dashboard', path: '/dashboard', icon: '📊' },
    { label: 'Proctoring Monitor', path: '/proctor-dashboard', icon: '🛡️' },
    { label: 'Take Exam', path: '/exam', icon: '📝' },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <span style={{ fontSize: '1.8rem' }}>🧠</span>
        <div>
          <div className="logo-text">Athena Proctor</div>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>AI Exam Security v2.0</span>
        </div>
      </div>

      {user && (
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-light)',
          background: 'rgba(255,255,255,0.02)'
        }}>
          <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
            {user.name || 'Student'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
            ID: {user.studentId || 'N/A'}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--primary)', marginTop: '4px' }}>
            {user.course || 'Computer Science'}
          </div>
        </div>
      )}

      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <div
            key={item.path}
            className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
            onClick={() => navigate(item.path)}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </div>
        ))}
      </nav>

      <div style={{ padding: '20px' }}>
        <button
          onClick={onLogout || (() => navigate('/'))}
          className="btn-proctor btn-danger"
          style={{ width: '100%', fontSize: '0.85rem', padding: '10px' }}
        >
          🚪 Sign Out
        </button>
      </div>
    </aside>
  );
}
