/**
 * gazeConfig.js
 * Centralized configurable thresholds and scoring constants for
 * Gaze Deviation & Attention Monitoring in Athena Proctor.
 *
 * NOTE: These are engineering risk thresholds, NOT definitive proof of cheating.
 */

export const GAZE_CONFIG = {
  // Sampling & Smoothing
  SAMPLE_INTERVAL_MS: 250,          // Frame evaluation sample interval
  SMOOTHING_BUFFER_SIZE: 6,         // Temporal sliding window size for majority voting

  // Duration Thresholds (Milliseconds)
  AWAY_IGNORE_DURATION_MS: 10000,    // Deviations < 10s are ignored as normal
  AWAY_SUSPICIOUS_DURATION_MS: 12000, // Deviations between 10s-12s are suspicious (+1 score)
  AWAY_EXTREME_DURATION_MS: 15000,   // Deviations > 12s are stronger suspicious events (+2 score)

  // Keyboard & Mouse Interaction Grace Window
  TYPING_GRACE_WINDOW_MS: 2200,      // Looking down within 2.2s of typing/mouse interaction is normal

  // Angle Boundaries for Head Pose (Degrees)
  HEAD_YAW_THRESHOLD: 18,            // ±18° yaw considered turned left/right
  HEAD_PITCH_UP_THRESHOLD: 15,       // > 15° pitch considered looking up
  HEAD_PITCH_DOWN_THRESHOLD: -15,    // < -15° pitch considered looking down

  // Suspicion Score Increment Values
  SCORE_NORMAL_GAZE: 0,
  SCORE_SHORT_AWAY: 0,
  SCORE_SUSPICIOUS_AWAY: 1,
  SCORE_EXTREME_AWAY: 2,
  SCORE_REPEATED_DEVIATION: 2,
  SCORE_FACE_MISSING: 3,
  SCORE_MULTI_FACE: 5,

  // Rolling Score Decay
  SCORE_DECAY_INTERVAL_MS: 10000,    // Decay 1 point every 10s of normal focused attention
  SCORE_DECAY_AMOUNT: 1,

  // Risk Classification Brackets
  RISK_LEVELS: {
    NORMAL: { min: 0, max: 2, label: 'NORMAL', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' },
    SUSPICIOUS: { min: 3, max: 5, label: 'SUSPICIOUS', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' },
    WARNING: { min: 6, max: 8, label: 'WARNING', color: '#f97316', bg: 'rgba(249, 115, 22, 0.15)' },
    HIGH_RISK: { min: 9, max: Infinity, label: 'HIGH RISK', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' }
  }
};

/**
 * Helper to compute current risk bracket from numerical score
 */
export function getRiskLevel(score) {
  const s = Math.max(0, Number(score) || 0);
  if (s <= GAZE_CONFIG.RISK_LEVELS.NORMAL.max) return GAZE_CONFIG.RISK_LEVELS.NORMAL;
  if (s <= GAZE_CONFIG.RISK_LEVELS.SUSPICIOUS.max) return GAZE_CONFIG.RISK_LEVELS.SUSPICIOUS;
  if (s <= GAZE_CONFIG.RISK_LEVELS.WARNING.max) return GAZE_CONFIG.RISK_LEVELS.WARNING;
  return GAZE_CONFIG.RISK_LEVELS.HIGH_RISK;
}

export default GAZE_CONFIG;
