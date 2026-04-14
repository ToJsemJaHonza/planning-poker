import { useEffect, useRef, useState } from 'react';
import { subscribe } from './MotionRuntime';

/**
 * Subscribe to the shared MotionRuntime rAF loop.
 *
 * The callback receives the same high-resolution timestamp every subscriber
 * sees in the current frame, so multiple subsystems can synchronize without
 * sampling Date.now() independently.
 *
 * @param {(now: number) => void} callback
 * @param {boolean} [enabled=true] - pass false to suspend
 */
export function useAnimationFrame(callback, enabled = true) {
  const cbRef = useRef(callback);
  cbRef.current = callback;

  useEffect(() => {
    if (!enabled) return undefined;
    return subscribe((now) => {
      const cb = cbRef.current;
      if (cb) cb(now);
    });
  }, [enabled]);
}

/**
 * Fire `callback` at most every `intervalMs`, time-based, driven by the
 * shared rAF loop instead of `setInterval`.
 *
 * Why not setInterval?
 *   - setInterval is throttled aggressively in background tabs (firing
 *     once per second instead of at the requested cadence) and the
 *     throttling differs between browsers and even between Chromium
 *     versions.
 *   - When focus returns the queued setInterval callbacks fire in a burst,
 *     causing visible "jumps" in stepped animations.
 *   - Multiple setIntervals on overlapping schedules drift against each
 *     other and against rAF, causing de-synchronisation between subsystems
 *     that should look like one motion.
 *
 * useFrameTicker piggybacks on MotionRuntime's single rAF, so all
 * frame-based subsystems see the same `now` and the same pause behaviour.
 *
 * @param {number} intervalMs   minimum gap between callback fires
 * @param {(now: number) => void} callback
 * @param {boolean} [enabled=true]
 */
export function useFrameTicker(intervalMs, callback, enabled = true) {
  const cbRef = useRef(callback);
  cbRef.current = callback;
  const lastFireRef = useRef(0);

  useEffect(() => {
    if (!enabled || !intervalMs || intervalMs <= 0) return undefined;
    lastFireRef.current = 0;
    return subscribe((now) => {
      if (lastFireRef.current === 0) {
        lastFireRef.current = now;
        cbRef.current?.(now);
        return;
      }
      if (now - lastFireRef.current >= intervalMs) {
        lastFireRef.current = now;
        cbRef.current?.(now);
      }
    });
  }, [intervalMs, enabled]);
}

/**
 * Convenience for the very common "flip a 0/1 frame every N ms" pattern
 * (walking-figure leg swap, sprite blink). Replaces the old
 * `setInterval(() => setFrame(f => f ^ 1), 500)` idiom.
 *
 * @param {number} intervalMs
 * @param {boolean} [enabled=true]
 * @returns {0 | 1}
 */
export function useFrameToggle(intervalMs, enabled = true) {
  const [frame, setFrame] = useState(0);
  useFrameTicker(intervalMs, () => setFrame((f) => (f ^ 1)), enabled);
  return frame;
}
