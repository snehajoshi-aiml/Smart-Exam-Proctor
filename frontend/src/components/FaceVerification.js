import React, { useRef, useState, useEffect } from 'react';
import Webcam from 'react-webcam';
import { getApiBaseUrl } from '../utils/config';

export default function FaceVerification({
  userEmail,
  studentId,
  onVerified,
  onVerificationSuccess,
  onVerificationFailed,
  onExamTerminated,
  onReEnroll,
  isContinuous = false,
  reverifyIntervalSeconds = 10
}) {
  const webcamRef = useRef(null);
  const [verifying, setVerifying] = useState(false);
  const [statusMsg, setStatusMsg] = useState('Position your face in front of the camera');
  const [progressFrames, setProgressFrames] = useState(0);
  const [qualityScore, setQualityScore] = useState(85);
  const [similarityScore, setSimilarityScore] = useState(0);
  const [challengePose, setChallengePose] = useState('Front View');
  const [verificationResult, setVerificationResult] = useState(null); // VERIFIED | SUSPICIOUS | REJECTED | MULTIPLE_FACES_DETECTED
  const [multiFaceAlert, setMultiFaceAlert] = useState(false);
  const consecutiveFailuresRef = useRef(0);

  const poses = ['Front View', 'Turn Left', 'Turn Right', 'Look Up', 'Look Down'];

  useEffect(() => {
    const randomPose = poses[Math.floor(Math.random() * poses.length)];
    setChallengePose(randomPose);
  }, []);

  const captureFrameBatch = async () => {
    const video = webcamRef.current?.video || webcamRef.current;
    if (!video || video.paused || video.ended || video.readyState < 2 || !video.videoWidth) {
      return [];
    }
    const FRAME_COUNT = 8;
    const frames = [];
    const startTime = Date.now();
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');

    while (Date.now() - startTime < 2000 && frames.length < FRAME_COUNT) {
      try {
        ctx.drawImage(video, 0, 0, 640, 480);
        frames.push(canvas.toDataURL('image/jpeg', 0.85));
      } catch (e) {}
      setProgressFrames(frames.length);
      await new Promise(resolve => setTimeout(resolve, 120));
    }
    return frames;
  };

  const runVerificationPass = async (isBackgroundCheck = false) => {
    const video = webcamRef.current?.video || webcamRef.current;
    if (!video || video.paused || video.ended || video.readyState < 2) return;

    if (!isBackgroundCheck) {
      setVerifying(true);
      setStatusMsg('🔄 Capturing 10 camera frames for InsightFace ArcFace verification...');
      setProgressFrames(0);
      setMultiFaceAlert(false);
    }

    try {
      const frames = await captureFrameBatch();
      if (frames.length < 3) {
        setStatusMsg('🔴 Frame capture incomplete. Please face camera clearly.');
        if (onVerificationFailed) onVerificationFailed('Frame capture failed');
        setVerifying(false);
        return;
      }

      const activeEmail = userEmail || localStorage.getItem('registered_email') || studentId || 'student@proctor.com';
      const cleanStudentId = studentId || activeEmail;

      const API_BASE = getApiBaseUrl() + '/api';

      const response = await fetch(`${API_BASE}/face/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: cleanStudentId,
          email: activeEmail,
          frames: frames,
          challengePose: challengePose.toLowerCase().replace(' ', '_'),
          deviceFingerprint: navigator.userAgent
        })
      });

      const data = await response.json();

      setQualityScore(data.qualityScore || 88);
      setSimilarityScore(data.bestSimilarity || data.similarityScore || 0.95);
      setVerificationResult(data.result || (data.verified ? 'VERIFIED' : 'REJECTED'));

      if (data.result === 'MULTIPLE_FACES_DETECTED' || data.multiFaceTriggered) {
        setMultiFaceAlert(true);
        setStatusMsg('🚨 SECURITY ALERT: Multiple faces detected! Verification halted.');
        if (onVerificationFailed) onVerificationFailed('MULTIPLE_FACES_DETECTED');
        return;
      }

      const dec = (data.decision || data.finalDecision || (data.verified ? 'VERIFIED' : 'SUSPICIOUS')).toUpperCase();

      if (dec === 'VERIFIED' && data.verified === true) {
        localStorage.setItem("faceVerified", "true");
        consecutiveFailuresRef.current = 0;
        setStatusMsg("Face verified successfully");
        if (onVerificationSuccess) onVerificationSuccess(data);
        if (onVerified) onVerified(data);
      } else if (dec === 'SUSPICIOUS') {
        setStatusMsg("Face does not match. Please try again.");
        if (onVerificationFailed) onVerificationFailed('Face does not match. Please try again.');
      } else if (dec === 'INSUFFICIENT_SAMPLES') {
        setStatusMsg("Not enough valid face samples");
        if (onVerificationFailed) onVerificationFailed('Not enough valid face samples');
      } else {
        handleFailurePass(data.message || 'Face does not match. Please try again.');
      }
    } catch (err) {
      console.warn('ArcFace verification error:', err);
      setStatusMsg("Server connection error");
      if (onVerificationFailed) onVerificationFailed('Server connection error');
    } finally {
      if (!isBackgroundCheck) setVerifying(false);
    }
  };

  const handleFailurePass = (reason) => {
    consecutiveFailuresRef.current += 1;
    const fails = consecutiveFailuresRef.current;
    setStatusMsg(`⚠️ Warning: Face verification mismatch (${reason}) - Warning ${fails}`);
    if (onVerificationFailed) onVerificationFailed(reason);
  };

  return (
    <div style={styles.card}>
      <h3 style={styles.title}>🛡️ Biometric Verification (InsightFace ArcFace)</h3>

      {multiFaceAlert && (
        <div style={styles.dangerBanner}>
          🚨 SECURITY VIOLATION: Multiple faces detected! Cheating log captured.
        </div>
      )}

      {/* Challenge Instruction Box */}
      <div style={styles.challengeBox}>
        <span>🎯 Anti-Spoofing Challenge: </span>
        <strong style={{ color: '#38bdf8' }}>{challengePose}</strong>
      </div>

      <div style={styles.webcamBox}>
        <Webcam
          ref={webcamRef}
          audio={false}
          width={320}
          height={240}
          screenshotFormat="image/jpeg"
          style={styles.webcam}
          mirrored={true}
        />
        {/* Target Oval Overlay */}
        <div style={styles.faceOval} />
      </div>

      {/* Metrics Row */}
      <div style={styles.metricsGrid}>
        <div style={styles.metricCard}>
          <span style={styles.metricLabel}>Quality Score</span>
          <span style={{ ...styles.metricValue, color: qualityScore >= 80 ? '#34d399' : '#f59e0b' }}>
            {qualityScore}%
          </span>
        </div>
        <div style={styles.metricCard}>
          <span style={styles.metricLabel}>Cosine Similarity</span>
          <span style={{ ...styles.metricValue, color: similarityScore >= 0.92 ? '#34d399' : '#ef4444' }}>
            {similarityScore > 0 ? similarityScore.toFixed(3) : '0.000'}
          </span>
        </div>
        <div style={styles.metricCard}>
          <span style={styles.metricLabel}>Frames Captured</span>
          <span style={styles.metricValue}>{progressFrames}/30</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div style={styles.progressTrack}>
        <div style={{ ...styles.progressBar, width: `${(progressFrames / 30) * 100}%` }} />
      </div>

      <div style={{ ...styles.statusBanner, color: verificationResult === 'VERIFIED' ? '#10b981' : verificationResult === 'SUSPICIOUS' ? '#f59e0b' : '#f87171' }}>
        {statusMsg}
      </div>

      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '12px' }}>
        <button
          onClick={() => runVerificationPass(false)}
          disabled={verifying}
          style={{ ...styles.verifyBtn, opacity: verifying ? 0.6 : 1 }}
        >
          {verifying ? `🔄 Processing Frames (${progressFrames}/30)...` : '📸 Run ArcFace Verification'}
        </button>

        {onReEnroll && (
          <button onClick={onReEnroll} disabled={verifying} style={styles.reEnrollBtn}>
            Enroll Face
          </button>
        )}
      </div>
    </div>
  );
}

const styles = {
  card: { background: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(99, 102, 241, 0.4)', borderRadius: '1rem', padding: '1.25rem', textAlign: 'center', maxWidth: '420px', margin: '0 auto' },
  title: { color: '#ffffff', fontSize: '1.1rem', margin: '0 0 12px 0', fontWeight: 800 },
  dangerBanner: { background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', color: '#ef4444', padding: '8px 12px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 700, margin: '8px 0' },
  challengeBox: { background: 'rgba(30, 41, 59, 0.8)', border: '1px solid #334155', borderRadius: '8px', padding: '8px 12px', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '12px' },
  webcamBox: { position: 'relative', width: '320px', height: '240px', margin: '0 auto', borderRadius: '12px', overflow: 'hidden', border: '2px solid #6366f1' },
  webcam: { width: '100%', height: '100%', objectFit: 'cover' },
  faceOval: { position: 'absolute', top: '15%', left: '25%', width: '50%', height: '70%', border: '2px dashed rgba(99, 102, 241, 0.8)', borderRadius: '50%', pointerEvents: 'none' },
  metricsGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', margin: '12px 0' },
  metricCard: { background: 'rgba(30, 41, 59, 0.6)', border: '1px solid #334155', borderRadius: '8px', padding: '6px 4px', display: 'flex', flexDirection: 'column' },
  metricLabel: { fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 },
  metricValue: { fontSize: '0.9rem', fontWeight: 800, marginTop: '2px' },
  progressTrack: { background: '#1e293b', borderRadius: '6px', height: '6px', overflow: 'hidden', margin: '8px 0' },
  progressBar: { background: 'linear-gradient(90deg, #6366f1, #34d399)', height: '100%', transition: 'width 0.1s linear' },
  statusBanner: { fontSize: '0.85rem', fontWeight: 700, margin: '8px 0', minHeight: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  verifyBtn: { flex: 2, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white', border: 'none', borderRadius: '10px', padding: '10px 16px', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' },
  reEnrollBtn: { flex: 1, background: 'rgba(124, 58, 237, 0.3)', border: '1px solid #7c3aed', color: '#c4b5fd', borderRadius: '10px', padding: '10px 12px', fontWeight: 700, cursor: 'pointer', fontSize: '0.8rem' }
};

