import React, { useState } from 'react';
import QuestionPalette from './QuestionPalette';

function MCQSection({ questions, answers: parentAnswers, onAnswerChange }) {
  const QUESTIONS_PER_PAGE = 2;
  const [currentPage, setCurrentPage] = useState(0);
  const [localAnswers, setLocalAnswers] = useState({});
  const answers = parentAnswers !== undefined ? parentAnswers : localAnswers;
  const [markedForReview, setMarkedForReview] = useState({});

  const totalPages = Math.ceil(questions.length / QUESTIONS_PER_PAGE);

  // Questions for current page
  const pageStartIndex = currentPage * QUESTIONS_PER_PAGE;
  const pageQuestions = questions.slice(pageStartIndex, pageStartIndex + QUESTIONS_PER_PAGE);

  const updateAnswers = (updater) => {
    if (typeof updater === 'function') {
      const next = updater(answers);
      if (onAnswerChange) onAnswerChange(next);
      else setLocalAnswers(next);
    } else {
      if (onAnswerChange) onAnswerChange(updater);
      else setLocalAnswers(updater);
    }
  };

  const handleSelectOption = (qIdx, optIdx) => {
    updateAnswers(prev => ({
      ...prev,
      [qIdx]: optIdx
    }));
  };

  const handleToggleReview = (qIdx) => {
    setMarkedForReview(prev => ({
      ...prev,
      [qIdx]: !prev[qIdx]
    }));
  };

  const handleClearResponse = (qIdx) => {
    updateAnswers(prev => {
      const copy = { ...prev };
      delete copy[qIdx];
      return copy;
    });
  };

  const handleNextPage = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(prev => prev + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 0) {
      setCurrentPage(prev => prev - 1);
    }
  };

  // Accurate Answer Counters
  const answeredCount = Object.values(answers).filter(val => val !== undefined && val !== null).length;
  const reviewCount = Object.values(markedForReview).filter(Boolean).length;
  const remainingCount = questions.length - answeredCount;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '16px' }}>
      {/* Top Section Banner & Live Counter */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'rgba(15, 23, 42, 0.8)',
        border: '1px solid #1e293b',
        borderRadius: '16px',
        padding: '14px 20px',
        flexWrap: 'wrap',
        gap: '10px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{
            background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
            color: 'white',
            padding: '6px 14px',
            borderRadius: '20px',
            fontWeight: 700,
            fontSize: '0.85rem'
          }}>
            Page {currentPage + 1} of {totalPages} (Questions {pageStartIndex + 1} - {Math.min(pageStartIndex + QUESTIONS_PER_PAGE, questions.length)})
          </span>
        </div>

        {/* Live Answer Tracker Badge */}
        <div style={{ display: 'flex', gap: '12px', fontSize: '0.82rem', fontWeight: 600 }}>
          <span style={{ color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '6px 12px', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
            ✅ Answered: {answeredCount} / {questions.length}
          </span>
          <span style={{ color: '#f59e0b', background: 'rgba(245, 158, 11, 0.1)', padding: '6px 12px', borderRadius: '12px', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
            ⏳ Remaining: {remainingCount}
          </span>
          <span style={{ color: '#a855f7', background: 'rgba(168, 85, 247, 0.1)', padding: '6px 12px', borderRadius: '12px', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
            🔖 Marked: {reviewCount}
          </span>
        </div>
      </div>

      {/* 2 Questions Per Page List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto', paddingRight: '4px' }}>
        {pageQuestions.map((q, subIdx) => {
          const globalQIdx = pageStartIndex + subIdx;
          const selectedOption = answers[globalQIdx];
          const isMarked = markedForReview[globalQIdx];
          const optionLetters = ['A', 'B', 'C', 'D'];

          return (
            <div
              key={q.id}
              style={{
                background: '#090d1a',
                border: `1px solid ${isMarked ? '#7c3aed' : selectedOption !== undefined ? '#10b981' : '#1e293b'}`,
                borderRadius: '16px',
                padding: '20px',
                borderLeft: `4px solid ${isMarked ? '#a855f7' : selectedOption !== undefined ? '#10b981' : '#6366f1'}`,
                boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                transition: 'all 0.3s ease'
              }}
            >
              {/* Question Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{
                    background: '#1e293b',
                    color: '#818cf8',
                    padding: '4px 10px',
                    borderRadius: '8px',
                    fontWeight: 700,
                    fontSize: '0.8rem'
                  }}>
                    Question {globalQIdx + 1}
                  </span>
                  <span style={{ fontSize: '0.78rem', color: '#94a3b8', background: '#0f172a', padding: '4px 10px', borderRadius: '12px', border: '1px solid #1e293b' }}>
                    🏷️ {q.category}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '0.78rem', color: '#10b981', fontWeight: 600 }}>
                    Points: +{q.points}
                  </span>
                  <button
                    onClick={() => handleToggleReview(globalQIdx)}
                    style={{
                      background: isMarked ? '#4c1d95' : 'transparent',
                      border: `1px solid ${isMarked ? '#7c3aed' : '#334155'}`,
                      color: isMarked ? '#ddd6fe' : '#94a3b8',
                      padding: '4px 10px',
                      borderRadius: '8px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    🔖 {isMarked ? 'Marked' : 'Mark Review'}
                  </button>
                  {selectedOption !== undefined && (
                    <button
                      onClick={() => handleClearResponse(globalQIdx)}
                      style={{
                        background: 'transparent',
                        border: '1px solid #334155',
                        color: '#ef4444',
                        padding: '4px 10px',
                        borderRadius: '8px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Question Text */}
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#f8fafc', marginBottom: '16px', lineHeight: 1.5 }}>
                {q.question}
              </h3>

              {/* 4 Options Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {q.options.map((optText, optIdx) => {
                  const isSelected = selectedOption === optIdx;

                  return (
                    <div
                      key={optIdx}
                      onClick={() => handleSelectOption(globalQIdx, optIdx)}
                      className={`athena-mcq-option ${isSelected ? 'selected' : ''}`}
                      style={{
                        background: isSelected ? 'rgba(99, 102, 241, 0.2)' : '#0f172a',
                        border: `1px solid ${isSelected ? '#6366f1' : '#1e293b'}`,
                        borderRadius: '12px',
                        padding: '12px 14px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <div className="athena-option-badge" style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '8px',
                        background: isSelected ? '#6366f1' : '#1e293b',
                        color: isSelected ? '#ffffff' : '#94a3b8',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '0.85rem'
                      }}>
                        {optionLetters[optIdx]}
                      </div>
                      <span style={{ fontSize: '0.88rem', color: isSelected ? '#ffffff' : '#cbd5e1', lineHeight: 1.3 }}>
                        {optText}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Page Navigation Controls */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: '14px',
        borderTop: '1px solid #1e293b'
      }}>
        <button
          onClick={handlePrevPage}
          disabled={currentPage === 0}
          style={{
            background: '#1e293b',
            border: '1px solid #334155',
            color: '#cbd5e1',
            padding: '10px 18px',
            borderRadius: '12px',
            fontWeight: 600,
            fontSize: '0.85rem',
            cursor: currentPage === 0 ? 'not-allowed' : 'pointer',
            opacity: currentPage === 0 ? 0.5 : 1
          }}
        >
          ⬅️ Previous Page
        </button>

        <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
          Showing Questions {pageStartIndex + 1}-{Math.min(pageStartIndex + QUESTIONS_PER_PAGE, questions.length)} of {questions.length}
        </span>

        <button
          onClick={handleNextPage}
          disabled={currentPage >= totalPages - 1}
          style={{
            background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
            border: 'none',
            color: 'white',
            padding: '10px 20px',
            borderRadius: '12px',
            fontWeight: 700,
            fontSize: '0.88rem',
            cursor: currentPage >= totalPages - 1 ? 'not-allowed' : 'pointer',
            opacity: currentPage >= totalPages - 1 ? 0.5 : 1,
            boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)'
          }}
        >
          Next Page ➡️
        </button>
      </div>

      {/* Question Palette Grid Navigator */}
      <QuestionPalette
        questions={questions}
        currentIndex={currentPage * QUESTIONS_PER_PAGE}
        answers={answers}
        markedForReview={markedForReview}
        onSelectQuestion={(idx) => {
          const targetPage = Math.floor(idx / QUESTIONS_PER_PAGE);
          setCurrentPage(targetPage);
        }}
      />
    </div>
  );
}

export default MCQSection;
