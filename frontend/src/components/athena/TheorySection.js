import React, { useState, useEffect } from 'react';

function TheorySection({ questions, essayAnswers: parentAnswers, onAnswerChange }) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [localAnswers, setLocalAnswers] = useState({});
  const essayAnswers = parentAnswers !== undefined ? parentAnswers : localAnswers;
  const [autoSaveStatus, setAutoSaveStatus] = useState('All changes saved');

  const currentQ = questions[currentQuestionIndex];
  const currentText = essayAnswers[currentQuestionIndex] || '';

  // Calculate word count & character count
  const wordCount = currentText.trim() === '' ? 0 : currentText.trim().split(/\s+/).length;
  const charCount = currentText.length;

  const updateAnswers = (updater) => {
    if (typeof updater === 'function') {
      const next = updater(essayAnswers);
      if (onAnswerChange) onAnswerChange(next);
      else setLocalAnswers(next);
    } else {
      if (onAnswerChange) onAnswerChange(updater);
      else setLocalAnswers(updater);
    }
  };

  // Auto-save debounce effect
  useEffect(() => {
    if (currentText) {
      setAutoSaveStatus('Saving...');
      const timer = setTimeout(() => {
        setAutoSaveStatus(`Auto-saved at ${new Date().toLocaleTimeString()}`);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [currentText]);

  const handleTextChange = (e) => {
    const val = e.target.value;
    updateAnswers(prev => ({
      ...prev,
      [currentQuestionIndex]: val
    }));
  };

  // Quick formatting toolbar insertion helper
  const insertFormatting = (prefix, suffix = '') => {
    const textarea = document.getElementById('theoryTextarea');
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = currentText.substring(start, end) || 'text';
    const replacement = `${prefix}${selectedText}${suffix}`;
    const newText = currentText.substring(0, start) + replacement + currentText.substring(end);
    
    updateAnswers(prev => ({ ...prev, [currentQuestionIndex]: newText }));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Question Selector Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
        {questions.map((q, idx) => (
          <button
            key={q.id}
            onClick={() => setCurrentQuestionIndex(idx)}
            style={{
              background: currentQuestionIndex === idx ? 'linear-gradient(135deg, #10b981, #059669)' : '#1e293b',
              border: 'none',
              color: 'white',
              padding: '8px 16px',
              borderRadius: '20px',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Theory Question {idx + 1}
          </button>
        ))}
      </div>

      {/* Question Card */}
      <div style={{
        background: '#090d1a',
        border: '1px solid #1e293b',
        borderRadius: '16px',
        padding: '20px',
        marginBottom: '16px',
        borderLeft: '4px solid #34d399'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc' }}>
            {currentQ.title}
          </h3>
          <span style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: 600 }}>
            Marks: {currentQ.marks} pts
          </span>
        </div>
        <p style={{ color: '#cbd5e1', fontSize: '0.9rem', lineHeight: 1.6 }}>
          {currentQ.prompt}
        </p>
      </div>

      {/* Rich Essay Textarea Editor Frame */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        background: '#090d1a',
        border: '1px solid #1e293b',
        borderRadius: '16px',
        overflow: 'hidden'
      }}>
        {/* Formatting Toolbar */}
        <div style={{
          background: '#0f172a',
          padding: '10px 16px',
          borderBottom: '1px solid #1e293b',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => insertFormatting('**', '**')}
              title="Bold"
              style={{ background: '#1e293b', border: '1px solid #334155', color: '#cbd5e1', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontWeight: 700 }}
            >
              B
            </button>
            <button
              onClick={() => insertFormatting('*', '*')}
              title="Italic"
              style={{ background: '#1e293b', border: '1px solid #334155', color: '#cbd5e1', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontStyle: 'italic' }}
            >
              I
            </button>
            <button
              onClick={() => insertFormatting('`', '`')}
              title="Inline Code"
              style={{ background: '#1e293b', border: '1px solid #334155', color: '#cbd5e1', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontFamily: 'monospace' }}
            >
              &lt;/&gt;
            </button>
            <button
              onClick={() => insertFormatting('- ')}
              title="Bullet List"
              style={{ background: '#1e293b', border: '1px solid #334155', color: '#cbd5e1', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer' }}
            >
              • List
            </button>
          </div>

          <div style={{ fontSize: '0.78rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <i className="fas fa-sync-alt" style={{ fontSize: '0.7rem' }}></i>
            <span>{autoSaveStatus}</span>
          </div>
        </div>

        {/* Text Area Input */}
        <textarea
          id="theoryTextarea"
          value={currentText}
          onChange={handleTextChange}
          placeholder={currentQ.placeholder}
          style={{
            flex: 1,
            minHeight: '280px',
            background: '#050811',
            border: 'none',
            color: '#f8fafc',
            padding: '18px',
            fontSize: '0.95rem',
            lineHeight: 1.6,
            outline: 'none',
            resize: 'none',
            fontFamily: 'Inter, sans-serif'
          }}
        />

        {/* Bottom Word Count Footer */}
        <div style={{
          background: '#0f172a',
          padding: '8px 16px',
          borderTop: '1px solid #1e293b',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.78rem',
          color: '#94a3b8'
        }}>
          <div>
            Minimum Suggested Words: <strong style={{ color: '#cbd5e1' }}>{currentQ.minWords}</strong>
          </div>
          <div style={{ display: 'flex', gap: '16px' }}>
            <span>Words: <strong style={{ color: wordCount >= currentQ.minWords ? '#34d399' : '#f59e0b' }}>{wordCount}</strong></span>
            <span>Characters: <strong style={{ color: '#60a5fa' }}>{charCount}</strong></span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TheorySection;
