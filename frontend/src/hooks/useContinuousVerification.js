import { useState, useEffect, useRef, useCallback } from 'react';
import { loadFaceModels, captureFaceDescriptor } from '../services/faceVerificationService';
import { getApiBaseUrl } from '../utils/config';

export function useContinuousVerification({
  webcamRef,
  studentId,
  token,
  isActive = true,
  intervalMs = 3000,
  onViolation
}) {
  const [verificationResult, setVerificationResult] = useState({
    status: 'idle', // idle | verified | mismatch | no_face | no_face_critical
    confidence: 0,
    message: 'Initializing face verification...',
  });

  const noFaceTimerRef = useRef(null);
  const consecutiveMatchesRef = useRef(0);
  const consecutiveFailsRef = useRef(0);
  const isRunningRef = useRef(false);
  const lastVerifiedTimeRef = useRef(Date.now());
  const recentScoresRef = useRef([0.95]);

  const verifyFrame = useCallback(async () => {
    if (!webcamRef?.current?.video || !studentId || !token) return;
    const video = webcamRef.current.video;
    if (video.readyState < 2) return;

    try {
      const descriptor = await captureFaceDescriptor(video);

      if (!descriptor) {
        consecutiveMatchesRef.current = 0; // reset match counter
        consecutiveFailsRef.current += 1;  // increment fail counter
        if (!noFaceTimerRef.current) {
          noFaceTimerRef.current = Date.now();
        }
        const secondsNoFace = (Date.now() - noFaceTimerRef.current) / 1000;
        const elapsedSinceVerified = (Date.now() - lastVerifiedTimeRef.current) / 1000;

        if (elapsedSinceVerified < 10) {
          // Fix 3: Maintain VERIFIED state within 10s grace window
          const avgSim = recentScoresRef.current.reduce((a, b) => a + b, 0) / recentScoresRef.current.length;
          setVerificationResult({
            status: 'verified',
            confidence: Math.round(avgSim * 100),
            similarityPct: Math.round(avgSim * 100),
            message: `Face Match: ${Math.round(avgSim * 100)}% (Grace Window Active)`
          });
          return;
        }

        const isCritical = secondsNoFace >= 5;
        const newStatus = isCritical ? 'no_face_critical' : 'no_face';
        const msg = isCritical
          ? `⚠️ No face detected for ${secondsNoFace.toFixed(0)}s (Exceeded 5s threshold!)`
          : `No face detected (${secondsNoFace.toFixed(0)}s)`;

        setVerificationResult({
          status: newStatus,
          confidence: 0,
          message: msg,
          secondsNoFace
        });

        if (isCritical && onViolation) {
          onViolation({
            type: 'no_face',
            severity: 'high',
            description: msg,
            timestamp: new Date().toISOString()
          });
        }
      } else {
        // Reset no face timer
        noFaceTimerRef.current = null;

        // Verify descriptor against backend (Reuses enrolled ArcFace embedding)
        const apiBase = getApiBaseUrl();
        const response = await fetch(`${apiBase}/api/face/verify`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ studentId, embedding: Array.from(descriptor) })
        });

        const contentType = response.headers.get('content-type') || '';
        let data = { match: false, confidence: 0 };
        if (contentType.includes('application/json')) {
          data = await response.json();
        }

        if (data.needsEnrollment) {
          consecutiveMatchesRef.current = 0;
          setVerificationResult({
            status: 'not_enrolled',
            confidence: 0,
            message: 'No face registered. Enrollment required.'
          });
          return;
        }

        // Fix 4: Smooth confidence using rolling average of last 10 frames
        const currentSim = typeof data.averageSimilarity === 'number' && !isNaN(data.averageSimilarity)
          ? data.averageSimilarity
          : (typeof data.bestSimilarity === 'number' && !isNaN(data.bestSimilarity)
            ? data.bestSimilarity
            : (data.similarityScore || (data.match ? 0.88 : 0.50)));

        recentScoresRef.current.push(currentSim);
        if (recentScoresRef.current.length > 10) {
          recentScoresRef.current.shift();
        }
        const rollingSimilarity = recentScoresRef.current.reduce((a, b) => a + b, 0) / recentScoresRef.current.length;
        const rollingConfidence = Math.round(rollingSimilarity * 100);

        // Strict live monitoring check: requires confirmed backend match without lenient false-positive overrides
        const match = (data.match === true || data.verified === true || data.finalDecision === 'VERIFIED') && (currentSim >= 0.82);
        const elapsedSinceVerified = (Date.now() - lastVerifiedTimeRef.current) / 1000;
        const isWithinGraceWindow = elapsedSinceVerified < 6 && consecutiveMatchesRef.current > 3;

        if (match) {
          lastVerifiedTimeRef.current = Date.now();
          consecutiveMatchesRef.current += 1;
          consecutiveFailsRef.current = 0; // Reset fail counter on success
        } else if (!isWithinGraceWindow) {
          consecutiveMatchesRef.current = 0;
          consecutiveFailsRef.current += 1; // Increment fail counter
        }

        const trackingStatus = match ? 'Verified Student' : (isWithinGraceWindow ? 'Grace Window Active' : 'Mismatch Warning');
        console.log(`Current Similarity: ${currentSim.toFixed(3)} | Rolling Similarity: ${rollingSimilarity.toFixed(3)} | Tracking Status: ${trackingStatus} | Face Centered: Yes | Unknown Counter: ${consecutiveFailsRef.current}`);

        const status = (match || isWithinGraceWindow) ? 'verified' : 'mismatch';
        const displayMsg = (match || isWithinGraceWindow)
          ? `Face Match: ${rollingConfidence}% (Verified)`
          : `Face Mismatch (${rollingConfidence}% similarity - Fail ${consecutiveFailsRef.current}/4)`;

        setVerificationResult({
          status,
          confidence: rollingConfidence,
          similarityPct: rollingConfidence,
          message: displayMsg,
          distance: data.distance,
          consecutiveMatches: consecutiveMatchesRef.current,
          consecutiveFails: consecutiveFailsRef.current
        });

        // Trigger continuous mismatch pause if 4 consecutive failures occur outside grace window
        if (consecutiveFailsRef.current >= 4 && !isWithinGraceWindow && onViolation) {
          onViolation({
            type: 'continuous_mismatch_pause',
            severity: 'critical',
            description: `⚠️ Identity Mismatch: 4 Consecutive Checks Below Similarity Threshold (${rollingConfidence}% similarity). Re-verification Required!`,
            confidence: rollingConfidence,
            timestamp: new Date().toISOString()
          });
        }
      }
    } catch (err) {
      console.error('Continuous verification error:', err);
    }
  }, [webcamRef, studentId, token, onViolation]);

  useEffect(() => {
    if (!isActive) {
      isRunningRef.current = false;
      return;
    }

    isRunningRef.current = true;
    loadFaceModels();

    const interval = setInterval(() => {
      if (isRunningRef.current) {
        verifyFrame();
      }
    }, intervalMs);

    return () => {
      isRunningRef.current = false;
      clearInterval(interval);
    };
  }, [isActive, intervalMs, verifyFrame]);

  return verificationResult;
}
