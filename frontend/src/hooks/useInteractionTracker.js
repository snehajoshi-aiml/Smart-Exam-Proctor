/**
 * useInteractionTracker.js
 * Privacy-preserving interaction tracker for candidate keyboard/mouse activity.
 *
 * IMPORTANT PRIVACY RULE:
 * Only stores the timestamp and interaction type.
 * NEVER captures, stores, or transmits keys, passwords, or typed text.
 */

import { useEffect, useRef } from 'react';
import { GAZE_CONFIG } from '../config/gazeConfig';

export function useInteractionTracker(isActive = true) {
  const lastInteractionRef = useRef({
    timestamp: Date.now(),
    type: 'none'
  });

  useEffect(() => {
    if (!isActive) return;

    const recordInteraction = (type) => () => {
      lastInteractionRef.current = {
        timestamp: Date.now(),
        type
      };
    };

    const onKeyDown = recordInteraction('keyboard');
    const onMouseMove = recordInteraction('mouse_move');
    const onMouseDown = recordInteraction('mouse_click');
    const onScroll = recordInteraction('scroll');

    window.addEventListener('keydown', onKeyDown, { passive: true });
    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('mousedown', onMouseDown, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('scroll', onScroll);
    };
  }, [isActive]);

  const isRecentInteraction = (graceWindowMs = GAZE_CONFIG.TYPING_GRACE_WINDOW_MS) => {
    const elapsed = Date.now() - lastInteractionRef.current.timestamp;
    return {
      isRecent: elapsed <= graceWindowMs,
      elapsedMs: elapsed,
      type: lastInteractionRef.current.type
    };
  };

  const getLastInteraction = () => lastInteractionRef.current;

  return { isRecentInteraction, getLastInteraction };
}

export default useInteractionTracker;
