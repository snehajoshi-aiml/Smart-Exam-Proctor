import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getApiBaseUrl } from '../utils/config';
import EnhancedProctoringService from '../services/enhancedProctoringService';

const ProctoringDashboard = ({ examId, onViolation }) => {
    const [isProctoring, setIsProctoring] = useState(false);
    const [logs, setLogs] = useState([]);
    const [violations, setViolations] = useState([]);

    useEffect(() => {
        // Listen for violation events
        window.addEventListener('proctoringViolation', handleViolation);
        
        return () => {
            window.removeEventListener('proctoringViolation', handleViolation);
            if (isProctoring) {
                stopProctoring();
            }
        };
    }, []);

    const handleViolation = (event) => {
        const { violationType, timestamp } = event.detail;
        setViolations(prev => [...prev, { type: violationType, timestamp }]);
        
        if (onViolation) {
            onViolation(violationType, timestamp);
        }
        
        // Show alert for serious violations
        if (violationType.includes('Phone') || violationType.includes('Tab')) {
            alert(`Warning: ${violationType} detected!`);
        }
    };

    const startProctoring = async () => {
        const success = await EnhancedProctoringService.startProctoring();
        if (success) {
            setIsProctoring(true);
            // Start periodic log fetching
            fetchLogs();
        }
    };

    const stopProctoring = () => {
        const sessionData = EnhancedProctoringService.stopProctoring();
        setIsProctoring(false);
        
        // Save session data to backend
        saveSessionData(sessionData);
    };

    const fetchLogs = async () => {
        try {
            const response = await fetch(`${getApiBaseUrl()}/api/proctoring/logs/${examId}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            const data = await response.json();
            if (data.success) {
                setLogs(data.logs);
            }
        } catch (error) {
            console.error('Error fetching logs:', error);
        }
    };

    const saveSessionData = async (sessionData) => {
        try {
            await fetch(`${getApiBaseUrl()}/api/proctoring/session/${examId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(sessionData)
            });
        } catch (error) {
            console.error('Error saving session:', error);
        }
    };

    const downloadReport = async () => {
        try {
            const response = await fetch(`${getApiBaseUrl()}/api/proctoring/report/${examId}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            const data = await response.json();
            
            // Create downloadable JSON file
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `proctoring_report_${examId}.json`;
            a.click();
        } catch (error) {
            console.error('Error downloading report:', error);
        }
    };

    return (
        <div className="proctoring-dashboard">
            <div className="controls">
                {!isProctoring ? (
                    <button onClick={startProctoring} className="btn-start">
                        Start Proctoring
                    </button>
                ) : (
                    <button onClick={stopProctoring} className="btn-stop">
                        Stop Proctoring
                    </button>
                )}
                <button onClick={downloadReport} className="btn-report">
                    Download Report
                </button>
            </div>
            
            <div className="stats">
                <div className="stat-card">
                    <h3>Violations</h3>
                    <p>{violations.length}</p>
                </div>
                <div className="stat-card">
                    <h3>Status</h3>
                    <p>{isProctoring ? 'Active' : 'Inactive'}</p>
                </div>
            </div>
            
            <div className="logs">
                <h3>Proctoring Logs</h3>
                <div className="log-list">
                    {logs.slice(0, 50).map(log => (
                        <div key={log.id} className={`log-entry ${log.type}`}>
                            <span className="timestamp">
                                {new Date(log.timestamp).toLocaleTimeString()}
                            </span>
                            <span className="message">{log.message}</span>
                        </div>
                    ))}
                </div>
            </div>
            
            <style jsx>{`
                .proctoring-dashboard {
                    padding: 20px;
                    background: #f5f5f5;
                    border-radius: 8px;
                }
                
                .controls {
                    margin-bottom: 20px;
                }
                
                button {
                    padding: 10px 20px;
                    margin-right: 10px;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                }
                
                .btn-start {
                    background: #4caf50;
                    color: white;
                }
                
                .btn-stop {
                    background: #f44336;
                    color: white;
                }
                
                .btn-report {
                    background: #2196f3;
                    color: white;
                }
                
                .stats {
                    display: flex;
                    gap: 20px;
                    margin-bottom: 20px;
                }
                
                .stat-card {
                    background: white;
                    padding: 15px;
                    border-radius: 8px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                    flex: 1;
                }
                
                .logs {
                    background: white;
                    border-radius: 8px;
                    padding: 15px;
                    max-height: 400px;
                    overflow-y: auto;
                }
                
                .log-entry {
                    padding: 8px;
                    border-bottom: 1px solid #eee;
                    font-size: 14px;
                }
                
                .log-entry.violation {
                    background: #ffebee;
                    color: #c62828;
                }
                
                .log-entry.warning {
                    background: #fff3e0;
                    color: #ef6c00;
                }
                
                .timestamp {
                    font-family: monospace;
                    margin-right: 10px;
                }
            `}</style>
        </div>
    );
};

export default ProctoringDashboard;