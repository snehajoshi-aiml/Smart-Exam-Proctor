import React, { useState } from 'react';

function CodingSection({ problems, onSubmitProblem }) {
  const [selectedProblemIndex, setSelectedProblemIndex] = useState(0);
  const [language, setLanguage] = useState('javascript');
  const [userCode, setUserCode] = useState(problems[0].starterCode.javascript);
  const [customInput, setCustomInput] = useState(problems[0].sampleInput);
  const [consoleOutput, setConsoleOutput] = useState('');
  const [activeConsoleTab, setActiveConsoleTab] = useState('output'); // 'input' | 'output' | 'status'
  const [executionStatus, setExecutionStatus] = useState(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [savedDraftStatus, setSavedDraftStatus] = useState('');

  const currentProblem = problems[selectedProblemIndex];

  // Handle problem selection change
  const handleSelectProblem = (idx) => {
    setSelectedProblemIndex(idx);
    const p = problems[idx];
    setUserCode(p.starterCode[language] || p.starterCode.javascript);
    setCustomInput(p.sampleInput);
    setConsoleOutput('');
    setExecutionStatus(null);
  };

  // Handle language change
  const handleLanguageChange = (lang) => {
    setLanguage(lang);
    if (currentProblem.starterCode[lang]) {
      setUserCode(currentProblem.starterCode[lang]);
    }
  };

  // Run Code Execution Simulation
  const handleRunCode = () => {
    setIsExecuting(true);
    setConsoleOutput('Compiling code and executing test cases...\n');
    setActiveConsoleTab('output');

    setTimeout(() => {
      setIsExecuting(false);
      setExecutionStatus({
        status: 'Accepted',
        runtime: `${Math.floor(10 + Math.random() * 25)}ms`,
        memory: `${(12 + Math.random() * 4).toFixed(1)} MB`,
        passedTests: '2/2'
      });
      setConsoleOutput(
        `✓ Test Case 1 Passed\nInput: ${currentProblem.sampleInput}\nExpected Output: ${currentProblem.sampleOutput}\nYour Output: ${currentProblem.sampleOutput}\n\n✓ Execution Completed Successfully.`
      );
    }, 800);
  };

  // Submit Code Simulation
  const handleSubmitCode = () => {
    setIsExecuting(true);
    setConsoleOutput('Submitting solution to judge server...\n');
    setActiveConsoleTab('status');

    setTimeout(() => {
      setIsExecuting(false);
      setExecutionStatus({
        status: 'ACCEPTED (100%)',
        runtime: '14 ms',
        memory: '14.2 MB',
        passedTests: '15/15 Hidden Testcases Passed'
      });
      setConsoleOutput('🎉 Solution Accepted! Score: 100/100 points.');
      if (onSubmitProblem) {
        onSubmitProblem(selectedProblemIndex);
      }
    }, 1200);
  };

  // Save Draft
  const handleSaveDraft = () => {
    setSavedDraftStatus('Draft saved at ' + new Date().toLocaleTimeString());
    setTimeout(() => setSavedDraftStatus(''), 3000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Problem Selector Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '14px',
        background: '#090d1a',
        padding: '10px 16px',
        borderRadius: '14px',
        border: '1px solid #1e293b'
      }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          {problems.map((p, idx) => (
            <button
              key={p.id}
              onClick={() => handleSelectProblem(idx)}
              style={{
                background: selectedProblemIndex === idx ? 'linear-gradient(135deg, #4f46e5, #7c3aed)' : '#1e293b',
                border: 'none',
                color: 'white',
                padding: '6px 14px',
                borderRadius: '20px',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Problem {idx + 1}
            </button>
          ))}
        </div>

        {savedDraftStatus && (
          <span style={{ fontSize: '0.78rem', color: '#10b981' }}>
            <i className="fas fa-check"></i> {savedDraftStatus}
          </span>
        )}
      </div>

      {/* LeetCode Split Pane */}
      <div className="athena-coding-split">
        {/* Left Pane: Problem Description & Constraints */}
        <div className="athena-coding-problem-pane">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc' }}>
              {currentProblem.title}
            </h2>
            <span style={{
              background: 'rgba(16, 185, 129, 0.15)',
              color: '#34d399',
              border: '1px solid #10b981',
              padding: '2px 10px',
              borderRadius: '20px',
              fontSize: '0.75rem',
              fontWeight: 700
            }}>
              {currentProblem.difficulty}
            </span>
          </div>

          <div style={{ color: '#cbd5e1', whiteSpace: 'pre-line', marginBottom: '20px' }}>
            {currentProblem.description}
          </div>

          {/* Constraints */}
          <div style={{ marginBottom: '20px' }}>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#60a5fa', marginBottom: '8px' }}>
              Constraints:
            </h4>
            <ul style={{ listStyle: 'disc', paddingLeft: '20px', color: '#94a3b8', fontSize: '0.82rem' }}>
              {currentProblem.constraints.map((c, i) => (
                <li key={i} style={{ marginBottom: '4px' }}><code>{c}</code></li>
              ))}
            </ul>
          </div>

          {/* Sample Input / Output */}
          <div style={{ marginBottom: '16px' }}>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#818cf8', marginBottom: '6px' }}>
              Sample Input:
            </h4>
            <pre style={{ background: '#050811', border: '1px solid #1e293b', padding: '10px', borderRadius: '8px', color: '#34d399', fontSize: '0.82rem' }}>
              {currentProblem.sampleInput}
            </pre>
          </div>

          <div>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#818cf8', marginBottom: '6px' }}>
              Sample Output:
            </h4>
            <pre style={{ background: '#050811', border: '1px solid #1e293b', padding: '10px', borderRadius: '8px', color: '#34d399', fontSize: '0.82rem' }}>
              {currentProblem.sampleOutput}
            </pre>
          </div>
        </div>

        {/* Right Pane: Code Editor & Console */}
        <div className="athena-code-editor-pane">
          {/* Editor Header Toolbar */}
          <div className="athena-editor-toolbar">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 600 }}>
                Language:
              </span>
              <select
                value={language}
                onChange={(e) => handleLanguageChange(e.target.value)}
                style={{
                  background: '#1e293b',
                  border: '1px solid #334155',
                  color: '#f8fafc',
                  padding: '4px 10px',
                  borderRadius: '8px',
                  fontSize: '0.82rem',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="javascript">JavaScript (ES6)</option>
                <option value="python">Python 3</option>
                <option value="cpp">C++ 17</option>
                <option value="java">Java 11</option>
                <option value="c">C (GCC)</option>
              </select>
            </div>

            {/* Action Buttons: Save Draft, Run, Submit */}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleSaveDraft}
                style={{
                  background: '#1e293b',
                  border: '1px solid #334155',
                  color: '#cbd5e1',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Save Draft
              </button>

              <button
                onClick={handleRunCode}
                disabled={isExecuting}
                style={{
                  background: '#334155',
                  border: 'none',
                  color: '#60a5fa',
                  padding: '6px 14px',
                  borderRadius: '8px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                {isExecuting ? 'Running...' : 'Run Code'}
              </button>

              <button
                onClick={handleSubmitCode}
                disabled={isExecuting}
                style={{
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  border: 'none',
                  color: 'white',
                  padding: '6px 16px',
                  borderRadius: '8px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Submit Code
              </button>
            </div>
          </div>

          {/* Monaco-style Code Editor Textarea */}
          <textarea
            value={userCode}
            onChange={(e) => setUserCode(e.target.value)}
            className="athena-code-textarea"
            placeholder="// Write code implementation here..."
          />

          {/* Bottom Console: Input, Output & Execution Status */}
          <div className="athena-console-panel">
            {/* Console Tab Selector */}
            <div style={{ display: 'flex', gap: '16px', marginBottom: '8px', borderBottom: '1px solid #1e293b', paddingBottom: '6px' }}>
              <span
                onClick={() => setActiveConsoleTab('output')}
                style={{ cursor: 'pointer', color: activeConsoleTab === 'output' ? '#60a5fa' : '#64748b', fontWeight: activeConsoleTab === 'output' ? 700 : 400 }}
              >
                Output Console
              </span>
              <span
                onClick={() => setActiveConsoleTab('input')}
                style={{ cursor: 'pointer', color: activeConsoleTab === 'input' ? '#60a5fa' : '#64748b', fontWeight: activeConsoleTab === 'input' ? 700 : 400 }}
              >
                Custom Input
              </span>
              <span
                onClick={() => setActiveConsoleTab('status')}
                style={{ cursor: 'pointer', color: activeConsoleTab === 'status' ? '#60a5fa' : '#64748b', fontWeight: activeConsoleTab === 'status' ? 700 : 400 }}
              >
                Execution Status
              </span>
            </div>

            {/* Tab 1: Output */}
            {activeConsoleTab === 'output' && (
              <pre style={{ color: '#cbd5e1', margin: 0, whiteSpace: 'pre-wrap' }}>
                {consoleOutput || 'Click "Run Code" or "Submit Code" to view execution results.'}
              </pre>
            )}

            {/* Tab 2: Custom Input */}
            {activeConsoleTab === 'input' && (
              <textarea
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                style={{ width: '100%', background: '#050811', border: '1px solid #334155', color: '#34d399', borderRadius: '6px', padding: '6px', fontSize: '12px', outline: 'none' }}
                rows={3}
              />
            )}

            {/* Tab 3: Execution Status */}
            {activeConsoleTab === 'status' && (
              <div>
                {executionStatus ? (
                  <div style={{ display: 'flex', gap: '20px', color: '#10b981' }}>
                    <div>Status: <strong>{executionStatus.status}</strong></div>
                    <div>Runtime: <strong>{executionStatus.runtime}</strong></div>
                    <div>Memory: <strong>{executionStatus.memory}</strong></div>
                  </div>
                ) : (
                  <span style={{ color: '#64748b' }}>No execution status yet.</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default CodingSection;
