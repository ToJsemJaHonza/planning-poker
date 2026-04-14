import { useEffect, useRef } from 'react';
import { subscribe } from './MotionRuntime';

/**
 * Wall-clock-elapsed animation loop. Backwards-compatible API for the
 * ceremony hooks (`useSlotMachine`, `useRoomStartCrowning`).
 *
 * Internally this delegates to `MotionRuntime` so all subsystems share one
 * `requestAnimationFrame` and the same visibility-pause behaviour.
 *
 * @param {((elapsed: number) => void) | null} callback
 *   Called every frame with the elapsed ms since the loop's logical start.
 *   Pass null to suspend the loop.
 * @param {number} [startedAt] - absolute timestamp (Date.now()) of the
 *   animation's logical start. If provided, elapsed = Date.now() - startedAt.
 *   Otherwise elapsed counts from when the loop subscribed.
 */
export function useAnimationLoop(callback, startedAt) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  // Effect re-runs only when the loop activates/suspends or its origin shifts.
  const enabled = callback !== null && callback !== undefined;

  useEffect(() => {
    if (!enabled) return undefined;
    const origin = startedAt ?? Date.now();

    // Fire one synchronous tick so the first paint already reflects t=0.
    // Matches the legacy behaviour of the old standalone rAF loop.
    callbackRef.current?.(Math.max(0, Date.now() - origin));

    return subscribe(() => {
      const cb = callbackRef.current;
      if (!cb) return;
      cb(Math.max(0, Date.now() - origin));
    });
  }, [enabled, startedAt]);
}
