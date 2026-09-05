import { useRef, useState } from 'react';
import { useAnimationLoop } from './useAnimationLoop';

// One clock for scenery, handoffs and cleanup. Late clients and resumed tabs
// enter at the event's current position, rather than replaying local timers.
export function useEventTimeline(timestamp, duration, onTime) {
  const origin = useRef(timestamp ?? Date.now());
  const [elapsed, setElapsed] = useState(() => Math.max(0, Date.now() - origin.current));
  const callback = useRef(onTime);
  callback.current = onTime;
  const finished = useRef(false);
  useAnimationLoop(finished.current ? null : (time) => {
    const clamped = Math.min(duration, time);
    callback.current?.(clamped);
    setElapsed(clamped);
    if (time >= duration) finished.current = true;
  }, origin.current);
  return elapsed;
}

export function timelinePhase(elapsed, beats) {
  let phase = beats[0][1];
  for (const [at, next] of beats) {
    if (elapsed < at) break;
    phase = next;
  }
  return phase;
}
