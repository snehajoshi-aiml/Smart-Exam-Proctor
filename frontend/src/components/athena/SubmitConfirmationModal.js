import React from 'react';

function SubmitConfirmationModal({
  isOpen,
  onClose,
  onConfirmSubmit,
  mcqStats,
  codingStats,
  theoryStats,
  totalViolations
}) {
  if (!isOpen) return null;

  return (
    <div className="athena-blocker-overlay">
      <div className="athena-blocker-card" style={{ maxWidth: '580px', padding: '32px' }}>
        <div style={{
          width: '64px',
          height: '64px',
          background: 'linear-gradient(135deg, #10b981, #059669)',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px auto',
          boxShadow: '0 0 20px rgba(16, 185, 129, 0.4)'
        }}>
          <i className="fas fa-flag-checkered" style={{ fontSize: '1.8rem', color: 'white' }}></i>
        </div>

        {/* Workflow Progress Badge */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(16, 185, 129, 0.15)',
          border: '1px solid rgba(16, 185, 129, 0.4)',
          color: '#34d399',
          padding: '4px 12px',
          borderRadius: '20px',
          fontSize: '0.75rem',
          fontWeight: 700,
          marginBottom: '12px',
          textTransform: 'uppercase',
          letterSpacing: '0.05em'
        }}>
          <span>🏁 Workflow Steps 11 & 12 of 12</span>
          <span>•</span>
          <span>Exam Completion & Report Generation</span>
        </div>

        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '8px', color: '#f8fafc' }}>
          Confirm Final Exam Submission
        </h2>
        <p style={{ color: '#94a3b8', fontSize: '0.88rem', marginBottom: '24px' }}>
          Please review your section completion statistics before submitting. Once submitted, your exam attempt will be locked.
        </p>

        {/* Completion Statistics Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '24px' }}>
          {/* MCQ Stats */}
          <div style={{ background: '#090d1a', border: '1px solid #1e293b', borderRadius: '14px', padding: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', color: '#c084fc', fontWeight: 600, marginBottom: '4px' }}>MCQ SECTION</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#f8fafc' }}>
              {mcqStats.answered}/{mcqStats.total}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Answered</div>
          </div>

          {/* Coding Stats */}
          <div style={{ background: '#090d1a', border: '1px solid #1e293b', borderRadius: '14px', padding: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', color: '#60a5fa', fontWeight: 600, marginBottom: '4px' }}>CODING SECTION</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#f8fafc' }}>
              {codingStats.submitted}/{codingStats.total}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Submitted</div>
          </div>

          {/* Theory Stats */}
          <div style={{ background: '#090d1a', border: '1px solid #1e293b', borderRadius: '14px', padding: '12px', textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', color: '#34d399', fontWeight: 600, marginBottom: '4px' }}>THEORY SECTION</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#f8fafc' }}>
              {theoryStats.completed}/{theoryStats.total}
            </div>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Completed</div>
          </div>
        </div>

        {/* Integrity Log Banner */}
        <div style={{
          background: totalViolations > 2 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
          border: `1px solid ${totalViolations > 2 ? '#ef4444' : '#10b981'}`,
          borderRadius: '12px',
          padding: '10px 14px',
          marginBottom: '28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.85rem'
        }}>
          <span style={{ color: '#cbd5e1' }}>Proctor Integrity Audit Logged:</span>
          <span style={{
            fontWeight: 700,
            color: totalViolations > 2 ? '#fca5a5' : '#34d399'
          }}>
            {totalViolations} Violations Recorded
          </span>
        </div>

        {/* Modal Controls */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: '12px',
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '12px',
              color: '#cbd5e1',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Return to Exam
          </button>

          <button
            onClick={onConfirmSubmit}
            style={{
              flex: 1,
              padding: '12px',
              background: 'linear-gradient(135deg, #10b981, #059669)',
              border: 'none',
              borderRadius: '12px',
              color: 'white',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)'
            }}
          >
            Confirm & Final Submit
          </button>
        </div>
      </div>
    </div>
  );
}

export default SubmitConfirmationModal;
