import { useEffect, useRef } from 'react';

/**
 * Shared animation loop driven by requestAnimationFrame.
 *
 * Replaces the `setInterval(tick, 16)` pattern used in ceremony hooks.
 * rAF naturally syncs with the browser's paint cycle (60fps or 120fps),
 * avoids double-paints, and correctly pauses when the tab is backgrounded.
 *
 * @param {((elapsed: number) => void) | null} callback
 *   Called every frame with the elapsed ms since the loop started.
 *   Pass null to pause/stop the loop.
 * @param {number} [startedAt] - absolute timestamp (Date.now()) of the
 *   animation's logical start. If provided, elapsed = Date.now() - startedAt.
 *   Otherwise elapsed counts from when the loop mounted.
 */
export function useAnimationLoop(callback, startedAt) {
  const rafRef = useRef(null);
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!callbackRef.current) return;

    const origin = startedAt ?? Date.now();

    const tick = () => {
      if (!callbackRef.current) return;
      const elapsed = Date.now() - origin;
      callbackRef.current(elapsed);
      rafRef.current = requestAnimationFrame(tick);
    };

    // Fire immediately, then schedule next frame
    tick();

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [callback === null, startedAt]); // restart when callback toggles on/off or startedAt changes
}
