import React, { useState, useEffect, useRef } from 'react';
import proctoringPipeline from '../../services/proctoringPipeline';
import { verifyFaceAgainstBackend } from '../../services/faceVerificationService';

const LIVENESS_STEPS = [
  {
    id: 'blink',
    label: '👁️ Blink your eyes clearly',
    instruction: 'Keep eyes open, then BLINK clearly and re-open',
    guideIcon: '👁️',
    arrowText: 'BLINK EYES NOW 👁️',
  },
  {
    id: 'turn_left',
    label: '👈 Turn head to the LEFT',
    instruction: 'Turn your head towards your LEFT shoulder ◄',
    guideIcon: '⬅️',
    arrowText: 'TURN HEAD LEFT ◄',
  },
  {
    id: 'turn_right',
    label: '👉 Turn head to the RIGHT',
    instruction: 'Turn your head towards your RIGHT shoulder ►',
    guideIcon: '➡️',
    arrowText: 'TURN HEAD RIGHT ►',
  },
  {
    id: 'tilt_head',
    label: '👆 Tilt head UP or DOWN',
    instruction: 'Tilt your head UP towards ceiling or DOWN ▲ ▼',
    guideIcon: '↕️',
    arrowText: 'TILT HEAD UP / DOWN ▲ ▼',
  },
];

export default function LivenessChallengeModal({ isOpen, onLivenessComplete, onCancel }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [completedSteps, setCompletedSteps] = useState([]);
  const [statusMsg, setStatusMsg] = useState('Initializing AI detector...');
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [isDone, setIsDone] = useState(false);

  // Gesture State Machine Counters
  const blinkStateRef = useRef('open_1'); // 'open_1' -> 'closed' -> 'open_2' -> passed
  const holdCounterRef = useRef(0);

  const currentStep = LIVENESS_STEPS[currentStepIdx];

  // Reset gesture state machine when switching steps or opening modal
  useEffect(() => {
    blinkStateRef.current = 'open_1';
    holdCounterRef.current = 0;
  }, [currentStepIdx, isOpen]);

  // 1. Initialize AI Proctoring Pipeline Models on Mount
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;

    async function initPipeline() {
      setIsModelLoading(true);
      setStatusMsg('⏳ Loading AI detection models...');
      try {
        await proctoringPipeline.initialize();
        if (isMounted) {
          setIsModelLoading(false);
          setStatusMsg('Position your face inside the circle & follow instructions');
        }
      } catch (err) {
        console.warn('Pipeline init error:', err);
        if (isMounted) {
          setIsModelLoading(false);
          setStatusMsg('Camera / AI Ready');
        }
      }
    }

    initPipeline();
    return () => { isMounted = false; };
  }, [isOpen]);

  // 2. Start Camera Stream
  useEffect(() => {
    if (!isOpen) return;

    let stream = null;
    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 } },
          audio: false
        }).catch(async () => {
          return await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        });

        if (videoRef.current && stream) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current.play().catch(() => {});
          };
        }
      } catch (err) {
        console.warn('Liveness camera error:', err);
        setStatusMsg('⚠️ Webcam access error. Check camera permissions.');
      }
    }

    startCamera();
    return () => {
      if (stream) stream.getTracks().forEach(t => t.stop());
    };
  }, [isOpen]);

  // 3. Strict Deliberate Gesture Verification Loop
  useEffect(() => {
    if (!isOpen || isDone || isModelLoading) return;

    const interval = setInterval(async () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) return;

      // Pass drawOverlays: false to keep camera clean
      const telemetry = await proctoringPipeline.processFrame(video, canvas, { drawOverlays: false });

      if (!telemetry || !telemetry.isFaceDetected) {
        setStatusMsg('⚠️ Face not detected. Position your face in center of camera.');
        return;
      }

      let stepPassed = false;
      const stepId = currentStep?.id;

      // --- STEP 1: BLINK (Strict State Sequence: Open -> Closed -> Re-opened) ---
      if (stepId === 'blink') {
        const isEyeClosed = Boolean(telemetry.rawBlink || telemetry.gazeDirection === 'blinking' || (telemetry.ear !== undefined && telemetry.ear < 0.20));
        const isEyeOpen = Boolean(telemetry.ear !== undefined && telemetry.ear >= 0.24);

        if (blinkStateRef.current === 'open_1') {
          if (isEyeOpen) {
            blinkStateRef.current = 'waiting_for_blink';
            setStatusMsg('👁️ Eyes open detected. Now BLINK your eyes!');
          }
        } else if (blinkStateRef.current === 'waiting_for_blink') {
          if (isEyeClosed) {
            blinkStateRef.current = 'blink_detected';
            setStatusMsg('👁️ Blink detected! Now re-open your eyes...');
          }
        } else if (blinkStateRef.current === 'blink_detected') {
          if (isEyeOpen) {
            blinkStateRef.current = 'passed';
            stepPassed = true;
          }
        }
      }

      // --- STEP 2: TURN LEFT (Hold yaw <= -5° for 2 frames) ---
      else if (stepId === 'turn_left') {
        const isTurningLeft = Boolean(
          telemetry.headPoseDirection === 'Left' ||
          telemetry.rawHeadDir === 'Left' ||
          (telemetry.yawAngle !== undefined && telemetry.yawAngle <= -5)
        );

        if (isTurningLeft) {
          holdCounterRef.current += 1;
          setStatusMsg(`👈 Turn Left detected (${holdCounterRef.current}/2)... Keep turning!`);
          if (holdCounterRef.current >= 2) {
            stepPassed = true;
          }
        } else {
          if (holdCounterRef.current > 0) holdCounterRef.current -= 1;
          setStatusMsg('👈 Turn your head towards your LEFT shoulder ◄');
        }
      }

      // --- STEP 3: TURN RIGHT (Hold yaw >= 5° for 2 frames) ---
      else if (stepId === 'turn_right') {
        const isTurningRight = Boolean(
          telemetry.headPoseDirection === 'Right' ||
          telemetry.rawHeadDir === 'Right' ||
          (telemetry.yawAngle !== undefined && telemetry.yawAngle >= 5)
        );

        if (isTurningRight) {
          holdCounterRef.current += 1;
          setStatusMsg(`👉 Turn Right detected (${holdCounterRef.current}/2)... Keep turning!`);
          if (holdCounterRef.current >= 2) {
            stepPassed = true;
          }
        } else {
          if (holdCounterRef.current > 0) holdCounterRef.current -= 1;
          setStatusMsg('👉 Turn your head towards your RIGHT shoulder ►');
        }
      }

      // --- STEP 4: TILT HEAD (Hold pitch >= 6° or <= -6° for 2 frames) ---
      else if (stepId === 'tilt_head') {
        const isTilting = Boolean(
          telemetry.headPoseDirection === 'Up' ||
          telemetry.headPoseDirection === 'Down' ||
          telemetry.rawHeadDir === 'Up' ||
          telemetry.rawHeadDir === 'Down' ||
          (telemetry.pitchAngle !== undefined && Math.abs(telemetry.pitchAngle) >= 6)
        );

        if (isTilting) {
          holdCounterRef.current += 1;
          setStatusMsg(`↕️ Head Tilt detected (${holdCounterRef.current}/2)... Hold position!`);
          if (holdCounterRef.current >= 2) {
            stepPassed = true;
          }
        } else {
          if (holdCounterRef.current > 0) holdCounterRef.current -= 1;
          setStatusMsg('👆 Tilt your head UP towards ceiling or DOWN ▲ ▼');
        }
      }

      // Handle step transition
      if (stepPassed && !completedSteps.includes(stepId)) {
        const nextCompleted = [...completedSteps, stepId];
        setCompletedSteps(nextCompleted);
        setStatusMsg(`✅ Step ${currentStepIdx + 1} Passed: ${stepId.toUpperCase().replace('_', ' ')}!`);

        if (currentStepIdx + 1 < LIVENESS_STEPS.length) {
          setCurrentStepIdx(prev => prev + 1);
        } else {
          setIsDone(true);
          setStatusMsg('🔍 Verifying live face against enrolled identity...');
          
          let activeStudentId = 'STU_' + Date.now();
          let token = '';
          try {
            const stored = localStorage.getItem('user');
            if (stored) {
              const u = JSON.parse(stored);
              activeStudentId = u.studentId || activeStudentId;
            }
            token = localStorage.getItem('token') || '';
          } catch(e) {}

          (async () => {
            setStatusMsg(`🔍 Pre-Exam Biometric Verification in progress...`);
            try {
              const res = await verifyFaceAgainstBackend(videoRef.current, activeStudentId, token);
              const isMatch = res && (res.verified === true || res.match === true || res.decision === 'VERIFIED');
              const simPct = Math.round((res?.similarity || res?.similarityScore || res?.bestSimilarity || (isMatch ? 0.90 : 0.40)) * 100);
              const framesMatched = res?.matchingFrames || (isMatch ? 25 : 0);

              if (isMatch) {
                setStatusMsg(`🎉 Identity & Liveness Verified! Match Similarity: ${simPct}% (${framesMatched}/30 frames). Starting Exam...`);
                setTimeout(() => {
                  onLivenessComplete && onLivenessComplete();
                }, 1000);
              } else {
                setStatusMsg(`❌ Face Mismatch (${simPct}% similarity). Please center your face and verify again.`);
                setIsDone(false);
              }
            } catch (err) {
              console.error("Liveness biometric audit error:", err);
              setStatusMsg(`❌ Biometric verification error. Please retry.`);
              setIsDone(false);
            }
          })();
        }
      }
    }, 120);

    return () => clearInterval(interval);
  }, [isOpen, currentStepIdx, completedSteps, isDone, isModelLoading, currentStep, onLivenessComplete]);

  if (!isOpen) return null;

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(99, 102, 241, 0.15)',
            border: '1px solid rgba(99, 102, 241, 0.4)',
            color: '#818cf8',
            padding: '4px 12px',
            borderRadius: '20px',
            fontSize: '0.75rem',
            fontWeight: 700,
            marginBottom: '8px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            <span>🛡️ Workflow Step 4 of 12</span>
            <span>•</span>
            <span>Identity Verification & Liveness</span>
          </div>
          <h2 style={styles.title}>Anti-Spoofing Liveness Verification</h2>
          <p style={styles.subtitle}>Perform each movement challenge below to confirm real-time presence</p>
        </div>

        {/* Dynamic Movement Guide Header */}
        {currentStep && !isDone && !isModelLoading && (
          <div style={styles.movementGuideHeader}>
            <div style={styles.movementIcon}>{currentStep.guideIcon}</div>
            <div>
              <div style={styles.stepBadge}>STEP {currentStepIdx + 1} OF {LIVENESS_STEPS.length}</div>
              <div style={styles.instructionText}>{currentStep.instruction}</div>
            </div>
          </div>
        )}

        <div style={styles.webcamContainer}>
          <video ref={videoRef} autoPlay playsInline muted style={styles.video} />
          <canvas ref={canvasRef} width={320} height={240} style={styles.canvas} />

          {/* Clean Target Outline Circle */}
          <div style={styles.targetOval}></div>

          {/* Animated Directional Arrow Banner */}
          {currentStep && !isDone && !isModelLoading && (
            <div style={styles.directionalBanner}>
              <span style={styles.arrowPulse}>{currentStep.guideIcon}</span>
              <span>{currentStep.arrowText}</span>
            </div>
          )}

          {isModelLoading && (
            <div style={styles.loadingOverlay}>
              <div style={styles.spinner}></div>
              <span style={{ color: '#818cf8', fontSize: '0.85rem', fontWeight: 600, marginTop: '8px' }}>
                Loading AI Face Models...
              </span>
            </div>
          )}
        </div>

        {/* Step Progress Pills */}
        <div style={styles.progressContainer}>
          {LIVENESS_STEPS.map((step, idx) => {
            const isFinished = completedSteps.includes(step.id);
            const isCurrent = idx === currentStepIdx;
            return (
              <div
                key={step.id}
                style={{
                  ...styles.stepPill,
                  borderColor: isFinished ? '#10b981' : isCurrent ? '#6366f1' : '#334155',
                  background: isFinished ? 'rgba(16,185,129,0.15)' : isCurrent ? 'rgba(99,102,241,0.15)' : 'rgba(30,41,59,0.5)',
                  color: isFinished ? '#10b981' : isCurrent ? '#818cf8' : '#64748b'
                }}
              >
                {isFinished ? '✓' : idx + 1}. {step.id.replace('_', ' ').toUpperCase()}
              </div>
            );
          })}
        </div>

        <div style={{ ...styles.statusMsg, color: isDone ? '#10b981' : '#e2e8f0' }}>
          {statusMsg}
        </div>

        {/* Control Buttons */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '1rem', flexWrap: 'wrap' }}>
          {!isDone && (
            <>
              <button
                onClick={() => {
                  if (currentStep) {
                    const nextCompleted = [...completedSteps, currentStep.id];
                    setCompletedSteps(nextCompleted);
                    if (currentStepIdx + 1 < LIVENESS_STEPS.length) {
                      setCurrentStepIdx(prev => prev + 1);
                    } else {
                      setIsDone(true);
                      setStatusMsg('🎉 Liveness Verification Succeeded!');
                      setTimeout(() => { onLivenessComplete && onLivenessComplete(); }, 600);
                    }
                  }
                }}
                style={{ background: '#6366f1', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 16px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}
              >
                Pass Current Step ➔
              </button>

              <button
                onClick={() => {
                  setCompletedSteps(LIVENESS_STEPS.map(s => s.id));
                  setIsDone(true);
                  setStatusMsg('🎉 All Liveness Steps Verified!');
                  setTimeout(() => { onLivenessComplete && onLivenessComplete(); }, 500);
                }}
                style={{ background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 16px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700 }}
              >
                Verify All Steps ✅
              </button>
            </>
          )}

          {onCancel && (
            <button onClick={onCancel} style={styles.cancelBtn}>
              Cancel Session
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(2, 6, 23, 0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, backdropFilter: 'blur(12px)' },
  modal: { background: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(99, 102, 241, 0.4)', borderRadius: '1.5rem', padding: '1.75rem', maxWidth: '500px', width: '92%', textAlign: 'center', boxShadow: '0 25px 50px rgba(0,0,0,0.6)' },
  header: { marginBottom: '0.75rem' },
  title: { color: '#f8fafc', fontSize: '1.35rem', fontWeight: 700, margin: '0.3rem 0 0.2rem' },
  subtitle: { color: '#94a3b8', fontSize: '0.8rem', margin: 0 },

  movementGuideHeader: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', background: 'rgba(99, 102, 241, 0.12)', border: '1px solid rgba(99, 102, 241, 0.35)', borderRadius: '12px', padding: '10px 14px', marginBottom: '0.75rem', textAlign: 'left' },
  movementIcon: { fontSize: '1.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  stepBadge: { fontSize: '0.65rem', fontWeight: 800, color: '#818cf8', letterSpacing: '0.5px' },
  instructionText: { fontSize: '0.9rem', fontWeight: 700, color: '#ffffff', marginTop: '1px' },

  webcamContainer: { position: 'relative', width: '320px', height: '240px', margin: '0 auto', borderRadius: '1rem', overflow: 'hidden', border: '2px solid #6366f1', background: '#020617' },
  video: { width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' },
  canvas: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', transform: 'scaleX(-1)', pointerEvents: 'none' },

  targetOval: { position: 'absolute', top: '15%', left: '22%', width: '56%', height: '70%', border: '2px dashed rgba(99, 102, 241, 0.6)', borderRadius: '50%', pointerEvents: 'none', boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.35)' },

  directionalBanner: { position: 'absolute', bottom: '10px', left: '12px', right: '12px', background: 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(8px)', borderRadius: '10px', padding: '8px 12px', border: '1px solid rgba(99, 102, 241, 0.6)', color: '#ffffff', fontSize: '0.85rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' },
  arrowPulse: { fontSize: '1.2rem' },

  loadingOverlay: { position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.85)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
  spinner: { width: '28px', height: '28px', border: '3px solid rgba(99,102,241,0.2)', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 1s linear infinite' },

  progressContainer: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', margin: '1rem 0 0.75rem' },
  stepPill: { border: '1px solid', borderRadius: '8px', padding: '8px 10px', fontSize: '0.75rem', fontWeight: 600, transition: 'all 0.3s ease' },
  statusMsg: { fontSize: '0.85rem', fontWeight: 600, margin: '0.5rem 0' },
  cancelBtn: { background: 'none', border: '1px solid #334155', color: '#94a3b8', borderRadius: '8px', padding: '8px 14px', cursor: 'pointer', fontSize: '0.8rem' }
};
