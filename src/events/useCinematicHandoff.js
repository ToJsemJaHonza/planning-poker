// @refresh reset
import { useState, useCallback, useRef, useEffect } from 'react';
import { useFrameTicker } from '../engine/useFrameTicker';

/**
 * Shared handoff mechanism for cinematic entrances (Richard's train,
 * Tomáš's DBB pipeline, etc).
 *
 * The cinematic figure starts at whatever fixed position its component
 * puts it in. When the animation timeline reaches the "walk to slot"
 * moment, the component calls `startHandoff()` which:
 *
 *   1. Finds the `[data-entrance-target="{name}"]` placeholder that
 *      PlayerList reserved in the grid.
 *   2. Measures both the cinematic figure rect and the target rect.
 *   3. Computes a distance-scaled walk duration + step count (UI
 *      Designer spec: ~6 ms/px, clamped [1800, 3200] ms, one foot plant
 *      per ~24 px).
 *   4. Applies an inline `transform` that a CSS `transition` drives to
 *      the target position.
 *
 * While the walk is in progress, `walkFrame` toggles between 0 and 1
 * at the computed stride rate, so the PlayerFigure's leg-swap sprite
 * syncs perfectly with the linear distance.
 *
 * When the transition completes, `finishHandoff()` signals the parent
 * that the cinematic figure has arrived at its grid slot. The placeholder
 * becomes visible exactly where the cinematic figure currently sits, so
 * the handoff is frame-precise — no teleport, no flicker.
 */
export function useCinematicHandoff(playerName, figureRef, onArrive) {
  const [transform, setTransform] = useState('translate(0px, 0px)');
  const [duration, setDuration] = useState(2500);
  const [stepCount, setStepCount] = useState(10);
  const [walkFrame, setWalkFrame] = useState(0);
  const [walking, setWalking] = useState(false);
  const [frameMs, setFrameMs] = useState(120);

  // Keep the arrive callback in a ref so finishHandoff doesn't change
  // identity every time the parent re-renders.
  const onArriveRef = useRef(onArrive);
  useEffect(() => { onArriveRef.current = onArrive; }, [onArrive]);

  // Leg-swap rides MotionRuntime — same shared rAF as every other figure,
  // so the cinematic walker stays synchronised with grid walkers.
  useFrameTicker(
    frameMs,
    () => setWalkFrame((f) => f ^ 1),
    walking,
  );

  const startHandoff = useCallback(() => {
    // Wait one frame so the figure is actually in the DOM with its final
    // layout before we measure it.
    requestAnimationFrame(() => {
      const selector = `[data-entrance-target="${cssEscape(playerName)}"]`;
      const target = document.querySelector(selector);
      const node = figureRef.current;
      if (!target || !node) {
        // Test / degraded environment fallback: do a simple upward nudge
        // so the animation still looks non-broken.
        setWalking(true);
        setDuration(2500);
        setStepCount(10);
        setFrameMs(125);
        setTransform('translate(0px, -200px)');
        return;
      }
      const t = target.getBoundingClientRect();
      const f = node.getBoundingClientRect();
      const dx = (t.left + t.width / 2) - (f.left + f.width / 2);
      const dy = (t.top + t.height / 2) - (f.top + f.height / 2);
      const d = Math.hypot(dx, dy);
      // UI Designer spec: ~6 ms/px, clamped
      const dur = Math.max(1800, Math.min(3200, Math.round(d * 6)));
      // One foot plant per ~24 px, capped so short walks don't stutter
      const steps = Math.max(4, Math.min(16, Math.round(d / 24)));
      const stride = Math.max(80, Math.round(dur / (steps * 2)));

      setWalking(true);
      setDuration(dur);
      setStepCount(steps);
      setFrameMs(stride);
      setTransform(`translate(${dx}px, ${dy}px)`);
    });
  }, [playerName, figureRef]);

  const finishHandoff = useCallback(() => {
    setWalking(false);
    onArriveRef.current?.();
    return new Promise((resolve) => {
      requestAnimationFrame(() => resolve());
    });
  }, []);

  return {
    transform,
    duration,
    stepCount,
    walkFrame,
    walking,
    startHandoff,
    finishHandoff,
  };
}

// Minimal CSS.escape polyfill — jsdom in the test harness exposes it,
// but older envs / edge runtimes don't. Player names are already
// sanitized upstream to strip `.` `$` `#` `[` `]` `/`, so the only
// risky characters remaining are quotes and backslashes.
function cssEscape(value) {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value);
  }
  return String(value).replace(/["\\]/g, '\\$&');
}
