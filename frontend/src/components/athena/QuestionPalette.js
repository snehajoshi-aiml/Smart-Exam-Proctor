import React from 'react';

function QuestionPalette({
  questions,
  currentIndex,
  answers,
  markedForReview,
  onSelectQuestion
}) {
  const getStatusClass = (idx) => {
    if (idx === currentIndex) return 'current';
    if (markedForReview[idx]) return 'review';
    if (answers[idx] !== undefined) return 'answered';
    return '';
  };

  const answeredCount = Object.values(answers).filter(v => v !== undefined && v !== null).length;
  const reviewCount = Object.values(markedForReview).filter(Boolean).length;
  const unansweredCount = questions.length - answeredCount;

  return (
    <div style={{ background: '#090d1a', border: '1px solid #1e293b', borderRadius: '16px', padding: '16px', marginTop: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <i className="fas fa-th" style={{ color: '#818cf8' }}></i>
          Question Palette & Navigator
        </h4>
        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
          {answeredCount}/{questions.length} Answered
        </span>
      </div>

      {/* Status Legend Bar */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '14px', fontSize: '0.72rem', color: '#94a3b8' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#064e3b', border: '1px solid #10b981' }}></span>
          <span>Answered ({answeredCount})</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#4c1d95', border: '1px solid #7c3aed' }}></span>
          <span>Marked for Review ({reviewCount})</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#0f172a', border: '1px solid #334155' }}></span>
          <span>Unanswered ({unansweredCount})</span>
        </div>
      </div>

      {/* Palette Grid */}
      <div className="athena-palette-grid">
        {questions.map((q, idx) => (
          <button
            key={q.id}
            onClick={() => onSelectQuestion(idx)}
            className={`athena-palette-btn ${getStatusClass(idx)}`}
          >
            {idx + 1}
          </button>
        ))}
      </div>
    </div>
  );
}

export default QuestionPalette;
