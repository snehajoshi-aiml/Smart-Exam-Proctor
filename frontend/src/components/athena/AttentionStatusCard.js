import React from 'react';

/**
 * AttentionStatusCard.js
 * Subtle, calm candidate-facing attention monitoring card.
 * Does NOT show frightening "Cheating" alerts or internal suspicion numbers.
 */
export default function AttentionStatusCard({ attentionState }) {
  const direction = (attentionState?.gazeDirection || 'CENTER').toUpperCase();
  const riskLevel = attentionState?.riskLevel || 'NORMAL';
  const isAway = attentionState?.isAway || false;
  const awayDuration = attentionState?.currentAwayDurationSec || 0;

  // Gentle, supportive status wording for the student
  let statusText = 'Attention: Focused on Screen';
  let badgeColor = '#10b981';
  let badgeBg = 'rgba(16, 185, 129, 0.12)';
  let icon = 'fas fa-eye';

  if (isAway && awayDuration >= 3.0) {
    statusText = 'Please remain focused on the exam screen';
    badgeColor = '#f59e0b';
    badgeBg = 'rgba(245, 158, 11, 0.15)';
    icon = 'fas fa-exclamation-circle';
  } else if (direction !== 'CENTER') {
    statusText = `Gaze: Looking ${direction.toLowerCase()}`;
    badgeColor = '#60a5fa';
    badgeBg = 'rgba(96, 165, 250, 0.12)';
    icon = 'fas fa-compass';
  }

  return (
    <div style={{
      background: 'rgba(15, 23, 42, 0.65)',
      border: `1px solid ${badgeColor}33`,
      borderRadius: '12px',
      padding: '12px 14px',
      marginBottom: '10px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      transition: 'all 0.3s ease'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '8px',
          background: badgeBg,
          color: badgeColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.9rem'
        }}>
          <i className={icon}></i>
        </div>
        <div>
          <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Attention Sentinel
          </div>
          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#f8fafc' }}>
            {statusText}
          </div>
        </div>
      </div>

      <span style={{
        fontSize: '0.7rem',
        fontWeight: 700,
        padding: '3px 8px',
        borderRadius: '6px',
        background: badgeBg,
        color: badgeColor,
        border: `1px solid ${badgeColor}44`,
        textTransform: 'uppercase'
      }}>
        {direction === 'CENTER' ? 'CENTER' : direction}
      </span>
    </div>
  );
}
