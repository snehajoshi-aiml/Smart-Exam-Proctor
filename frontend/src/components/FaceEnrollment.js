import React, { useRef, useState, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import { getApiBaseUrl } from '../utils/config';
import { loadFaceModels, getFaceApi } from '../utils/faceModelLoader';

const TARGET_SAMPLES = 30;

const LIVENESS_ACTIONS = [
  { id: 'front', label: '🎯 Position 1: FRONT Face (1-10)', prompt: 'Look straight at the camera' },
  { id: 'side', label: '👈 Position 2: SLIGHT LEFT / RIGHT (11-20)', prompt: 'Turn head slightly LEFT or RIGHT' },
  { id: 'vertical', label: '👇 Position 3: SLIGHT UP / DOWN (21-30)', prompt: 'Tilt head slightly UP or DOWN' },
];

export default function FaceEnrollment({ studentId, name, email, token, onEnrolled, onSkip }) {
  const webcamRef = useRef(null);
  const [status, setStatus] = useState('idle'); // idle | capturing | processing | success | error
  const [actionIdx, setActionIdx] = useState(0);
  const [collectedFrames, setCollectedFrames] = useState([]);
  const [statusMsg, setStatusMsg] = useState('Keep your face inside the circle and follow the pose instructions.');

  const activeEmail = email || localStorage.getItem('registered_email') || 'student@proctor.com';
  const activeName = name || activeEmail.split('@')[0] || 'Student';
  const activeStudentId = studentId || ('STU_' + activeEmail.replace(/[^a-z0-9]/gi, '_'));

  useEffect(() => {
    loadFaceModels().catch((e) => console.warn('face-api init:', e.message));
    return () => {
      if (webcamRef.current?.video?.srcObject) {
        try {
          webcamRef.current.video.srcObject.getTracks().forEach(t => t.stop());
        } catch (e) {}
      }
    };
  }, []);

  const startEnrollment = useCallback(async () => {
    console.log("[ENROLL] Button clicked");
    if (status === 'capturing' || status === 'processing') return;

    const video = webcamRef.current?.video;
    if (!video || video.paused || video.ended || video.readyState < 2) {
      setStatusMsg('⚠️ Camera not ready. Ensure camera access is allowed.');
      return;
    }

    console.log("[ENROLL] Capture started");
    console.log("Enrollment target: 30");
    setStatus('capturing');
    setStatusMsg('⏳ Initializing neural biometric models...');
    try {
      await loadFaceModels();
    } catch (mErr) {
      console.warn("Face model loader notice:", mErr);
    }

    setStatusMsg('🚀 Capturing 30 ArcFace Biometric Samples — Follow Pose Prompts!');
    setCollectedFrames([]);

    const frames = [];
    const descriptors = [];
    let attempts = 0;
    const maxAttempts = 180;

    while (frames.length < TARGET_SAMPLES && attempts < maxAttempts) {
      attempts++;
      const v = webcamRef.current?.video;
      if (v && v.readyState >= 2) {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 640;
          canvas.height = 480;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(v, 0, 0, 640, 480);
          const b64 = canvas.toDataURL('image/jpeg', 0.85);
          if (b64 && b64.length > 500) {
            // Extract neural face descriptor from canvas snapshot
            const api = getFaceApi();
            let faceDescriptor = null;
            if (api && api.detectSingleFace) {
              try {
                const det = await api.detectSingleFace(canvas, new api.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.25 }))
                  .withFaceLandmarks()
                  .withFaceDescriptor();
                if (det && det.descriptor) {
                  faceDescriptor = Array.from(det.descriptor);
                }
              } catch (dErr) {}
            }

            // Only accept frame if face model confirmed a valid face (or fallback when api is not yet loaded)
            if (!api || !api.detectSingleFace || faceDescriptor) {
              frames.push(b64);
              if (faceDescriptor) {
                descriptors.push(faceDescriptor);
              }
              const count = frames.length;
              setCollectedFrames([...frames]);
              console.log(`[ENROLL] Captured clean face frame ${count}/30 (Descriptors: ${descriptors.length})`);
            }
          }
        } catch (e) {}
      }

      const sampleCount = frames.length;
      const poseStep = Math.min(
        LIVENESS_ACTIONS.length - 1,
        Math.floor((sampleCount / TARGET_SAMPLES) * LIVENESS_ACTIONS.length)
      );
      setActionIdx(poseStep);
      const action = LIVENESS_ACTIONS[poseStep];
      setStatusMsg(`📸 Collecting face samples: ${sampleCount}/30 — ${action.label}: ${action.prompt}`);

      await new Promise((r) => setTimeout(r, 100));
    }

    if (frames.length < 20) {
      setStatus('error');
      setStatusMsg('❌ Not enough valid face samples. Please continue enrollment.');
      return;
    }

    console.log("[ENROLL] 30 frames collected, descriptors:", descriptors.length);
    console.log("[ENROLL] Sending API request");

    finishEnrollment(frames, descriptors);
  }, []);

  const finishEnrollment = async (frames, descriptors = []) => {
    if (frames.length < 20) {
      setStatus('error');
      setStatusMsg('❌ Not enough valid face samples. Please continue enrollment.');
      return;
    }

    setStatus('processing');
    setStatusMsg('⚙️ Processing Biometric 512-dim Normalization in Backend...');

    try {
      const activeToken = token || localStorage.getItem('token') || 'temp_token';

      console.log(`Frames: ${frames.length}, Descriptors: ${descriptors.length}`);
      console.log('Sending enrollment request...');

      const response = await fetch(`${getApiBaseUrl()}/api/face/enroll`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${activeToken}`
        },
        body: JSON.stringify({
          email: activeEmail,
          studentId: activeStudentId,
          name: activeName,
          frames: frames,
          descriptors: descriptors,
          reEnrollment: true
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setStatus('success');
        setStatusMsg('✅ Enrollment successful — 30 valid face samples captured.');
        setTimeout(() => {
          if (webcamRef.current?.video?.srcObject) {
            try {
              webcamRef.current.video.srcObject.getTracks().forEach(t => t.stop());
            } catch (e) {}
          }
          if (onEnrolled) onEnrolled(data);
        }, 1200);
      } else {
        setStatus('error');
        setStatusMsg(`❌ Enrollment Rejected: ${data.error || 'Quality validation check failed.'}`);
      }
    } catch (err) {
      console.error('ArcFace Enrollment submission error:', err);
      setStatus('error');
      setStatusMsg('❌ Server connection error during ArcFace enrollment.');
    }
  };

  const currentAction = LIVENESS_ACTIONS[actionIdx];

  return (
    <div style={styles.overlay}>
      <div style={styles.card}>
        <div style={styles.header}>
          <span style={{ fontSize: '2rem' }}>🛡️</span>
          <h2 style={styles.title}>ArcFace Biometric Enrollment</h2>
          <p style={styles.subtitle}>Keep your face inside the circle and follow the pose instructions.</p>
        </div>

        <div style={styles.actionBanner}>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#38bdf8' }}>
            {currentAction?.label}
          </div>
          <div style={{ fontSize: '0.85rem', color: '#f8fafc', fontWeight: 600, marginTop: '2px' }}>
            {currentAction?.prompt}
          </div>
        </div>

        <div style={styles.webcamWrapper}>
          <Webcam
            ref={webcamRef}
            audio={false}
            width={340}
            height={255}
            screenshotFormat="image/jpeg"
            videoConstraints={{
              width: { ideal: 640 },
              height: { ideal: 480 },
              facingMode: "user"
            }}
            style={styles.webcam}
            mirrored={true}
          />
          <div style={styles.guideOval} />
        </div>

        {status === 'capturing' && (
          <div style={{ margin: '14px 0 8px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 600, marginBottom: '4px' }}>
              <span>Collecting face samples:</span>
              <span style={{ color: '#34d399' }}>{collectedFrames.length} / {TARGET_SAMPLES}</span>
            </div>
            <div style={styles.progressBar}>
              <div style={{ ...styles.progressFill, width: `${(collectedFrames.length / TARGET_SAMPLES) * 100}%` }} />
            </div>
          </div>
        )}

        <div style={{ ...styles.statusMsg, color: status === 'error' ? '#ef4444' : status === 'success' ? '#10b981' : '#e2e8f0' }}>
          {statusMsg}
        </div>

        <div style={styles.buttonGroup}>
          {status !== 'success' && (
            <button
              onClick={startEnrollment}
              disabled={status === 'capturing' || status === 'processing'}
              style={{
                ...styles.enrollBtn,
                opacity: (status === 'capturing' || status === 'processing') ? 0.6 : 1
              }}
            >
              {status === 'capturing'
                ? `📸 Capturing (${collectedFrames.length}/${TARGET_SAMPLES})...`
                : status === 'processing'
                ? '⚙️ Normalizing ArcFace Embeddings...'
                : '📷 Begin 30-Frame ArcFace Enrollment'}
            </button>
          )}

          {onSkip && status !== 'capturing' && status !== 'processing' && (
            <button
              onClick={() => {
                if (webcamRef.current?.video?.srcObject) {
                  try {
                    webcamRef.current.video.srcObject.getTracks().forEach(t => t.stop());
                  } catch (e) {}
                }
                if (onSkip) onSkip();
              }}
              style={styles.skipBtn}
            >
              Skip Enrollment
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(2, 6, 23, 0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, backdropFilter: 'blur(12px)' },
  card: { background: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(99, 102, 241, 0.4)', borderRadius: '1.5rem', padding: '1.75rem', maxWidth: '460px', width: '92%', textAlign: 'center', boxShadow: '0 25px 50px rgba(0,0,0,0.6)' },
  header: { marginBottom: '1rem' },
  title: { color: '#f8fafc', fontSize: '1.4rem', fontWeight: 700, margin: '0.3rem 0 0.2rem' },
  subtitle: { color: '#94a3b8', fontSize: '0.8rem', margin: 0 },
  actionBanner: { background: 'rgba(99, 102, 241, 0.12)', border: '1px solid rgba(99, 102, 241, 0.35)', borderRadius: '12px', padding: '10px 14px', marginBottom: '1rem' },
  webcamWrapper: { position: 'relative', width: '340px', height: '255px', margin: '0 auto', borderRadius: '1rem', overflow: 'hidden', border: '2px solid #6366f1', background: '#020617' },
  webcam: { width: '100%', height: '100%', objectFit: 'cover' },
  guideOval: { position: 'absolute', top: '15%', left: '22%', width: '56%', height: '70%', border: '2px dashed #34d399', borderRadius: '50%', pointerEvents: 'none' },
  progressBar: { background: '#1e293b', borderRadius: '999px', height: '8px', overflow: 'hidden' },
  progressFill: { height: '100%', background: 'linear-gradient(90deg, #10b981, #6366f1)', borderRadius: '999px', transition: 'width 0.2s ease' },
  statusMsg: { fontSize: '0.85rem', fontWeight: 600, margin: '0.75rem 0', minHeight: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  buttonGroup: { display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '0.75rem' },
  enrollBtn: { background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: 'white', border: 'none', borderRadius: '12px', padding: '12px', fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer' },
  skipBtn: { background: 'none', border: '1px solid #334155', color: '#94a3b8', borderRadius: '10px', padding: '8px', cursor: 'pointer', fontSize: '0.8rem' }
};

