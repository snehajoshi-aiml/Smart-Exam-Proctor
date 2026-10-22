import React, { useEffect, useState } from 'react';

const STATUS_CONFIG = {
    idle: { color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', label: 'Initializing...', icon: '⏳' },
    calibrating: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', label: 'Calibrating', icon: '🔄' },
    verified: { color: '#10b981', bg: 'rgba(16,185,129,0.1)', label: 'Identity Verified', icon: '✅' },
    mismatch: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)', label: 'Face Mismatch!', icon: '❌' },
    no_face: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', label: 'No Face Detected', icon: '👤' },
    no_face_critical: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)', label: 'Face Missing (>5s)', icon: '🚨' },
    not_enrolled: { color: '#6366f1', bg: 'rgba(99,102,241,0.1)', label: 'Not Enrolled', icon: '🔐' },
};

export default function FaceVerificationStatus({
    verificationResult,
    sessionActive,
    violationCount = 0,
    blinkCount = 0,
    isCalibrated = false,
}) {
    const [pulse, setPulse] = useState(false);
    const status = verificationResult?.status || 'idle';
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.idle;
    const confidence = verificationResult?.confidence ?? null;

    // Pulse animation on mismatch or critical
    useEffect(() => {
        if (status === 'mismatch' || status === 'no_face_critical') {
            setPulse(true);
            const t = setTimeout(() => setPulse(false), 1000);
            return () => clearTimeout(t);
        }
    }, [status, verificationResult]);

    return (
        <div style={{
            ...styles.card,
            borderColor: config.color,
            animation: pulse ? 'shake 0.4s ease' : 'none',
            background: config.bg,
        }}>
            <div style={styles.header}>
                <span style={{ fontSize: '1.5rem' }}>{config.icon}</span>
                <div>
                    <div style={styles.cardTitle}>Face Verification</div>
                    <div style={{ ...styles.statusLabel, color: config.color }}>{config.label}</div>
                </div>
                <div style={{ ...styles.dot, background: config.color }} />
            </div>

            {confidence !== null && (
                <div style={styles.confidenceSection}>
                    <div style={styles.confLabel}>Confidence</div>
                    <div style={styles.confBar}>
                        <div style={{
                            ...styles.confFill,
                            width: `${(confidence * 100).toFixed(0)}%`,
                            background: confidence > 0.7 ? '#10b981' : confidence > 0.4 ? '#f59e0b' : '#ef4444',
                        }} />
                    </div>
                    <div style={{ ...styles.confValue, color: config.color }}>
                        {(confidence * 100).toFixed(1)}%
                    </div>
                </div>
            )}

            <div style={styles.stats}>
                <div style={styles.statItem}>
                    <span style={styles.statLabel}>Session</span>
                    <span style={{ ...styles.statValue, color: sessionActive ? '#10b981' : '#64748b' }}>
                        {sessionActive ? 'Active' : 'Inactive'}
                    </span>
                </div>
                <div style={styles.statItem}>
                    <span style={styles.statLabel}>Violations</span>
                    <span style={{ ...styles.statValue, color: violationCount > 0 ? '#ef4444' : '#10b981' }}>
                        {violationCount}
                    </span>
                </div>
                <div style={styles.statItem}>
                    <span style={styles.statLabel}>Blinks</span>
                    <span style={styles.statValue}>{blinkCount}</span>
                </div>
                <div style={styles.statItem}>
                    <span style={styles.statLabel}>Calibrated</span>
                    <span style={{ ...styles.statValue, color: isCalibrated ? '#10b981' : '#f59e0b' }}>
                        {isCalibrated ? 'Yes' : 'No'}
                    </span>
                </div>
            </div>

            {verificationResult?.message && (
                <div style={{ ...styles.message, color: config.color }}>
                    {verificationResult.message}
                </div>
            )}
        </div>
    );
}

const styles = {
    card: { background: 'rgba(15,23,42,0.8)', borderRadius: '1rem', border: '1px solid', padding: '1rem', transition: 'all 0.3s ease' },
    header: { display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' },
    cardTitle: { color: '#e2e8f0', fontWeight: 600, fontSize: '0.9rem' },
    statusLabel: { fontSize: '0.75rem', fontWeight: 500, marginTop: '2px' },
    dot: { width: '10px', height: '10px', borderRadius: '50%', marginLeft: 'auto', boxShadow: '0 0 6px currentColor' },
    confidenceSection: { display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' },
    confLabel: { color: '#94a3b8', fontSize: '0.75rem', whiteSpace: 'nowrap' },
    confBar: { flex: 1, height: '6px', background: '#1e293b', borderRadius: '999px', overflow: 'hidden' },
    confFill: { height: '100%', borderRadius: '999px', transition: 'width 0.5s ease, background 0.3s' },
    confValue: { fontSize: '0.75rem', fontWeight: 700, minWidth: '40px', textAlign: 'right' },
    stats: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', marginBottom: '0.5rem' },
    statItem: { background: 'rgba(30,41,59,0.6)', borderRadius: '0.5rem', padding: '0.35rem 0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    statLabel: { color: '#64748b', fontSize: '0.7rem' },
    statValue: { color: '#e2e8f0', fontSize: '0.75rem', fontWeight: 600 },
    message: { fontSize: '0.7rem', textAlign: 'center', marginTop: '0.25rem', fontStyle: 'italic' },
};
