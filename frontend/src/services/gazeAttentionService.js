/**
 * gazeAttentionService.js
 * Production-ready Gaze Deviation and Attention Monitoring Engine.
 *
 * Implements:
 * - Multi-factor gaze & head pose evaluation
 * - Temporal smoothing & debouncing (no false alarm on brief saccades or blinks)
 * - Duration-based thresholds (<3s ignore, 3-5s suspicious, >5s warning)
 * - Keyboard / mouse interaction context grace period
 * - Rolling, decaying suspicion score
 * - Offline event queueing & resilience sync
 */

import { GAZE_CONFIG, getRiskLevel } from '../config/gazeConfig';
import { getApiBaseUrl } from '../utils/config';

class GazeAttentionService {
  constructor() {
    this.reset();
    this.offlineQueueKey = 'athena_gaze_offline_queue';
    this.setupNetworkListener();
  }

  reset() {
    this.gazeBuffer = new Array(GAZE_CONFIG.SMOOTHING_BUFFER_SIZE).fill('CENTER');
    this.bufferIdx = 0;

    this.currentDirection = 'CENTER';
    this.isAway = false;
    this.awayStartTime = null;
    this.currentAwayDurationMs = 0;
    this.longestAwayDurationMs = 0;
    this.totalDeviationsCount = 0;

    this.suspicionScore = 0;
    this.lastDecayTime = Date.now();
    this.lastLoggedState = 'NORMAL';

    this.recentEvents = [];
    this.lastEventDispatchedTime = 0;

    this.sessionContext = {
      studentId: null,
      examId: null,
      sessionId: null,
      token: null
    };
  }

  setSessionContext({ studentId, examId, sessionId, token }) {
    this.sessionContext = {
      studentId: studentId || this.sessionContext.studentId,
      examId: examId || this.sessionContext.examId,
      sessionId: sessionId || this.sessionContext.sessionId,
      token: token || this.sessionContext.token
    };
  }

  setupNetworkListener() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.flushOfflineQueue();
      });
    }
  }

  /**
   * Evaluates a frame of telemetry
   * @param {Object} frameTelemetry { rawGazeDir, headPose, personCount, isFaceDetected, confidence, interactionContext }
   * @returns {Object} Attention analysis state
   */
  processTelemetry(frameTelemetry = {}) {
    const now = Date.now();
    const {
      rawGazeDir = 'CENTER',
      headPose = { yaw: 0, pitch: 0, roll: 0 },
      personCount = 1,
      isFaceDetected = true,
      confidence = 90,
      interactionContext = { isRecent: false, type: 'none' }
    } = frameTelemetry;

    // 1. Temporal Smoothing (Sliding Window Buffer)
    const normalizedRaw = (rawGazeDir || 'CENTER').toUpperCase();
    this.gazeBuffer[this.bufferIdx] = normalizedRaw;
    this.bufferIdx = (this.bufferIdx + 1) % GAZE_CONFIG.SMOOTHING_BUFFER_SIZE;
    const smoothedDirection = this._getMajorityVote(this.gazeBuffer);

    // 2. Head Pose & Interaction Context Refinement
    let effectiveDirection = smoothedDirection;
    const isLookingDown = smoothedDirection === 'DOWN' || headPose.pitch < GAZE_CONFIG.HEAD_PITCH_DOWN_THRESHOLD;

    // Context Rule: Looking down while actively typing or using mouse is considered normal interaction
    if (isLookingDown && interactionContext.isRecent) {
      effectiveDirection = 'CENTER';
    }

    // Normal blinking is treated as CENTER
    if (smoothedDirection === 'BLINKING') {
      effectiveDirection = 'CENTER';
    }

    // 3. Duration Tracking
    const isCurrentlyAway = effectiveDirection !== 'CENTER' && isFaceDetected;

    if (isCurrentlyAway) {
      if (!this.isAway) {
        // Gaze departure initiated
        this.isAway = true;
        this.awayStartTime = now;
        this.currentAwayDurationMs = 0;
      } else {
        this.currentAwayDurationMs = now - (this.awayStartTime || now);
        if (this.currentAwayDurationMs > this.longestAwayDurationMs) {
          this.longestAwayDurationMs = this.currentAwayDurationMs;
        }
      }
    } else {
      if (this.isAway) {
        // Gaze returned to center
        const finalDurationMs = this.currentAwayDurationMs;
        this._handleGazeReturn(finalDurationMs, this.currentDirection, headPose, confidence, interactionContext);
        this.isAway = false;
        this.awayStartTime = null;
        this.currentAwayDurationMs = 0;
      }
    }

    this.currentDirection = effectiveDirection;

    // 4. Check sustained deviation thresholds while looking away
    if (this.isAway) {
      this._checkActiveDeviationThresholds(this.currentAwayDurationMs, effectiveDirection, headPose, confidence, interactionContext);
    }

    // 5. Score Decay on sustained normal focus
    if (!this.isAway && isFaceDetected && personCount === 1) {
      if (now - this.lastDecayTime >= GAZE_CONFIG.SCORE_DECAY_INTERVAL_MS) {
        if (this.suspicionScore > 0) {
          this.suspicionScore = Math.max(0, this.suspicionScore - GAZE_CONFIG.SCORE_DECAY_AMOUNT);
        }
        this.lastDecayTime = now;
      }
    }

    // 6. Compute current risk bracket
    const currentRisk = getRiskLevel(this.suspicionScore);

    return {
      gazeDirection: effectiveDirection,
      rawGazeDir: normalizedRaw,
      headPose,
      isAway: this.isAway,
      currentAwayDurationSec: parseFloat((this.currentAwayDurationMs / 1000).toFixed(1)),
      longestAwayDurationSec: parseFloat((this.longestAwayDurationMs / 1000).toFixed(1)),
      totalDeviationsCount: this.totalDeviationsCount,
      suspicionScore: this.suspicionScore,
      riskLevel: currentRisk.label,
      riskColor: currentRisk.color,
      riskBg: currentRisk.bg,
      interactionContext,
      statusLabel: this._getStatusMessage(effectiveDirection, currentRisk.label, this.currentAwayDurationMs)
    };
  }

  _checkActiveDeviationThresholds(durationMs, direction, headPose, confidence, interactionContext) {
    const now = Date.now();

    // Trigger Suspicious Event (At 3000ms - 5000ms threshold)
    if (durationMs >= GAZE_CONFIG.AWAY_IGNORE_DURATION_MS && durationMs < (GAZE_CONFIG.AWAY_IGNORE_DURATION_MS + 400)) {
      if (now - this.lastEventDispatchedTime > 2500) {
        this.totalDeviationsCount++;
        this.suspicionScore += GAZE_CONFIG.SCORE_SUSPICIOUS_AWAY;
        this._recordAndDispatchEvent('GAZE_DEVIATION', direction, durationMs, headPose, confidence, interactionContext);
        this.lastEventDispatchedTime = now;
      }
    }

    // Trigger Stronger Event (At > 5000ms threshold)
    if (durationMs >= GAZE_CONFIG.AWAY_SUSPICIOUS_DURATION_MS && durationMs < (GAZE_CONFIG.AWAY_SUSPICIOUS_DURATION_MS + 400)) {
      if (now - this.lastEventDispatchedTime > 3000) {
        this.suspicionScore += GAZE_CONFIG.SCORE_EXTREME_AWAY;
        this._recordAndDispatchEvent('PROLONGED_AWAY', direction, durationMs, headPose, confidence, interactionContext);
        this.lastEventDispatchedTime = now;
      }
    }
  }

  _handleGazeReturn(durationMs, direction, headPose, confidence, interactionContext) {
    // Only log returns from meaningful deviations (> 3s)
    if (durationMs >= GAZE_CONFIG.AWAY_IGNORE_DURATION_MS) {
      this._recordAndDispatchEvent('ATTENTION_RESTORED', 'CENTER', durationMs, headPose, confidence, interactionContext);
    }
  }

  _recordAndDispatchEvent(eventType, direction, durationMs, headPose, confidence, interactionContext) {
    const currentRisk = getRiskLevel(this.suspicionScore);
    const durationSec = parseFloat((durationMs / 1000).toFixed(1));

    const eventPayload = {
      eventType,
      studentId: this.sessionContext.studentId || 'STU_CURRENT',
      examId: this.sessionContext.examId || 'EXAM_MAIN',
      sessionId: this.sessionContext.sessionId || 'SESSION_ACTIVE',
      gazeDirection: direction,
      headPose: {
        yaw: headPose?.yaw || 0,
        pitch: headPose?.pitch || 0,
        roll: headPose?.roll || 0
      },
      duration: durationSec,
      suspicionScore: this.suspicionScore,
      riskLevel: currentRisk.label,
      confidence: Math.round(confidence || 90),
      interactionContext: {
        wasInteracting: interactionContext?.isRecent || false,
        lastInteractionType: interactionContext?.type || 'none'
      },
      timestamp: new Date().toISOString()
    };

    // Store in recent in-memory list (limit 20)
    this.recentEvents.unshift(eventPayload);
    if (this.recentEvents.length > 20) this.recentEvents.pop();

    // Send to backend API and offline queue
    this.sendEventToBackend(eventPayload);
  }

  async sendEventToBackend(eventPayload) {
    try {
      const apiBase = getApiBaseUrl();
      const token = this.sessionContext.token || localStorage.getItem('token');

      const response = await fetch(`${apiBase}/api/proctoring/gaze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(eventPayload)
      });

      if (!response.ok) {
        this._enqueueOffline(eventPayload);
      }
    } catch (err) {
      console.warn('⚠️ Gaze event network notice, stored in offline queue:', err.message);
      this._enqueueOffline(eventPayload);
    }
  }

  _enqueueOffline(eventPayload) {
    try {
      const existing = JSON.parse(localStorage.getItem(this.offlineQueueKey) || '[]');
      existing.push(eventPayload);
      if (existing.length > 50) existing.shift(); // Bound maximum queue size
      localStorage.setItem(this.offlineQueueKey, JSON.stringify(existing));
    } catch (e) {
      // Quota or storage notice ignored
    }
  }

  async flushOfflineQueue() {
    try {
      const queue = JSON.parse(localStorage.getItem(this.offlineQueueKey) || '[]');
      if (queue.length === 0) return;

      console.log(`🔄 Flushing ${queue.length} offline gaze attention events to backend...`);
      const apiBase = getApiBaseUrl();
      const token = this.sessionContext.token || localStorage.getItem('token');

      for (const item of queue) {
        await fetch(`${apiBase}/api/proctoring/gaze`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify(item)
        }).catch(() => {});
      }

      localStorage.removeItem(this.offlineQueueKey);
      console.log('✅ Offline gaze events synced successfully');
    } catch (err) {
      console.warn('⚠️ Offline sync retry notice:', err.message);
    }
  }

  _getMajorityVote(arr) {
    const counts = {};
    let maxItem = arr[0];
    let maxCount = 0;
    for (const item of arr) {
      counts[item] = (counts[item] || 0) + 1;
      if (counts[item] > maxCount) {
        maxCount = counts[item];
        maxItem = item;
      }
    }
    return maxItem;
  }

  _getStatusMessage(direction, riskLabel, durationMs) {
    if (riskLabel === 'HIGH RISK') {
      return 'Please remain focused on the exam screen.';
    }
    if (durationMs >= GAZE_CONFIG.AWAY_IGNORE_DURATION_MS) {
      return 'Attention: Candidate looking away from screen';
    }
    return 'Attention monitoring active';
  }
}

const gazeAttentionService = new GazeAttentionService();
export default gazeAttentionService;
