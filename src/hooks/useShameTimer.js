import { useState, useEffect, useRef } from 'react';

const SHAME_STAGES = [
  { minSeconds: 0,   name: 'none' },
  { minSeconds: 30,  name: 'gentle' },
  { minSeconds: 45,  name: 'antsy' },
  { minSeconds: 60,  name: 'heat' },
  { minSeconds: 80,  name: 'maximum' },
  { minSeconds: 100, name: 'absurd' },
];

function computeStage(elapsedMs) {
  const seconds = elapsedMs / 1000;
  let stage = 0;
  for (let i = SHAME_STAGES.length - 1; i >= 0; i--) {
    if (seconds >= SHAME_STAGES[i].minSeconds) {
      stage = i;
      break;
    }
  }
  return stage;
}

/**
 * Hook that computes the current shame stage from a Firebase-synced timer.
 * @param {{ holdoutName: string, holdoutId: string, startedAt: number } | null} shameTimer
 * @param {string} playerId - Current player's ID
 * @returns {{ stage: number, elapsed: number, holdoutName: string|null, isHoldout: boolean }}
 */
export function useShameTimer(shameTimer, playerId) {
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!shameTimer || !shameTimer.startedAt) {
      setElapsed(0);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const tick = () => setElapsed(Date.now() - shameTimer.startedAt);
    tick();
    intervalRef.current = setInterval(tick, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [shameTimer?.startedAt, shameTimer?.holdoutId]);

  if (!shameTimer) {
    return { stage: 0, elapsed: 0, holdoutName: null, isHoldout: false };
  }

  const stage = computeStage(elapsed);
  return {
    stage,
    elapsed,
    holdoutName: shameTimer.holdoutName,
    isHoldout: shameTimer.holdoutId === playerId,
  };
}
