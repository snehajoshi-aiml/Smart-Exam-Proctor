import React, { useState, useEffect } from 'react';
import enhancedProctoringService from '../services/enhancedProctoringService';

const EyeTrackingWidget = ({ position = 'top-right' }) => {
    const [gazeState, setGazeState] = useState({
        direction: 'center',
        isCalibrating: true,
        isCalibrated: false,
        calibrationProgress: 0,
        blinkCount: 0
    });

    const [alertMessage, setAlertMessage] = useState(null);

    useEffect(() => {
        const handleGazeUpdate = (e) => {
            const data = e.detail;
            setGazeState({
                direction: data.direction,
                isCalibrating: data.isCalibrating,
                isCalibrated: data.isCalibrated,
                calibrationProgress: data.calibrationProgress,
                blinkCount: data.blinkCount
            });
        };

        const handleEyeAlert = (e) => {
            setAlertMessage(e.detail.message);
            setTimeout(() => setAlertMessage(null), 4000);
        };

        window.addEventListener('gazeUpdate', handleGazeUpdate);
        window.addEventListener('eyeMovementAlert', handleEyeAlert);

        return () => {
            window.removeEventListener('gazeUpdate', handleGazeUpdate);
            window.removeEventListener('eyeMovementAlert', handleEyeAlert);
        };
    }, []);

    const handleRecalibrate = () => {
        if (enhancedProctoringService.eyeMovementDetection) {
            enhancedProctoringService.eyeMovementDetection.recalibrate();
        }
    };

    const getDirectionIcon = (dir) => {
        switch (dir) {
            case 'left': return '←';
            case 'right': return '→';
            case 'up': return '↑';
            case 'down': return '↓';
            case 'blinking': return '👁️';
            case 'center': default: return '🎯';
        }
    };

    const getDirectionLabel = (dir) => {
        switch (dir) {
            case 'left': return 'Looking Left';
            case 'right': return 'Looking Right';
            case 'up': return 'Looking Up';
            case 'down': return 'Looking Down';
            case 'blinking': return 'Blinking';
            case 'center': default: return 'Center (OK)';
        }
    };

    const getStatusColor = (dir, isCalibrating) => {
        if (isCalibrating) return '#3b82f6'; // Blue
        if (dir === 'center' || dir === 'blinking') return '#10b981'; // Green
        return '#ef4444'; // Red
    };

    return (
        <div style={styles.container}>
            {/* Main Eye Tracker Badge */}
            <div style={{
                ...styles.badge,
                borderColor: getStatusColor(gazeState.direction, gazeState.isCalibrating)
            }}>
                <span style={{
                    ...styles.dot,
                    backgroundColor: getStatusColor(gazeState.direction, gazeState.isCalibrating)
                }} />

                {gazeState.isCalibrating ? (
                    <div style={styles.calibrationBox}>
                        <span style={styles.calibText}>Calibrating Baseline ({gazeState.calibrationProgress}%)</span>
                        <div style={styles.progressBarBg}>
                            <div style={{
                                ...styles.progressBarFill,
                                width: `${gazeState.calibrationProgress}%`
                            }} />
                        </div>
                    </div>
                ) : (
                    <div style={styles.gazeBox}>
                        <span style={styles.icon}>{getDirectionIcon(gazeState.direction)}</span>
                        <span style={styles.label}>{getDirectionLabel(gazeState.direction)}</span>
                    </div>
                )}

                <button 
                    onClick={handleRecalibrate}
                    title="Click to recalibrate neutral eye gaze"
                    style={styles.recalibBtn}
                >
                    🔄
                </button>
            </div>

            {/* Live Alert Toast Banner */}
            {alertMessage && (
                <div style={styles.alertToast}>
                    <span style={styles.alertIcon}>⚠️</span>
                    <span>{alertMessage}</span>
                </div>
            )}
        </div>
    );
};

const styles = {
    container: {
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: '8px',
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif"
    },
    badge: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        backgroundColor: 'rgba(15, 23, 42, 0.88)',
        backdropFilter: 'blur(12px)',
        color: '#ffffff',
        padding: '8px 14px',
        borderRadius: '30px',
        border: '1.5px solid #10b981',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.25)',
        fontSize: '13px',
        fontWeight: 600,
        transition: 'all 0.3s ease'
    },
    dot: {
        width: '10px',
        height: '10px',
        borderRadius: '50%',
        boxShadow: '0 0 8px currentColor'
    },
    calibrationBox: {
        display: 'flex',
        flexDirection: 'column',
        gap: '3px',
        minWidth: '140px'
    },
    calibText: {
        fontSize: '11px',
        color: '#94a3b8',
        whiteSpace: 'nowrap'
    },
    progressBarBg: {
        width: '100%',
        height: '4px',
        backgroundColor: '#334155',
        borderRadius: '2px',
        overflow: 'hidden'
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: '#3b82f6',
        transition: 'width 0.2s ease'
    },
    gazeBox: {
        display: 'flex',
        alignItems: 'center',
        gap: '6px'
    },
    icon: {
        fontSize: '14px'
    },
    label: {
        fontSize: '12px',
        letterSpacing: '0.3px'
    },
    recalibBtn: {
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        fontSize: '12px',
        padding: '2px 4px',
        borderRadius: '4px',
        opacity: 0.75,
        transition: 'opacity 0.2s',
        outline: 'none'
    },
    alertToast: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        backgroundColor: '#ef4444',
        color: '#ffffff',
        padding: '10px 16px',
        borderRadius: '12px',
        boxShadow: '0 4px 16px rgba(239, 68, 68, 0.4)',
        fontSize: '12px',
        fontWeight: 600,
        animation: 'slideIn 0.3s ease-out'
    },
    alertIcon: {
        fontSize: '14px'
    }
};

export default EyeTrackingWidget;
