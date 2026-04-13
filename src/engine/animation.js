/**
 * Shared animation constants and easing utilities.
 *
 * Centralizes timing, easing curves, and transition helpers so every
 * animated component in the app uses consistent, smooth motion.
 */

/** Walk-frame toggle interval (ms). Used by WalkingFigure and Wizard. */
export const WALK_FRAME_MS = 500;

/** Ceremony walk-frame toggle interval (ms). Faster pace during ceremonies. */
export const CEREMONY_WALK_FRAME_MS = 400;

/**
 * CSS easing curves.
 *
 * Pixel art movement benefits from a slight ease-in-out rather than pure
 * linear — the acceleration/deceleration at boundaries makes the motion
 * feel intentional rather than robotic, while still reading as "walking".
 */
export const EASING = {
  /** Default walk easing — subtle acceleration at start, deceleration at end. */
  walk: 'cubic-bezier(0.25, 0.05, 0.25, 1)',
  /** Walk exit — slightly faster ease-out so departure feels decisive. */
  walkOut: 'cubic-bezier(0.42, 0, 0.58, 1)',
  /** Smooth position interpolation for ceremony wizard movement. */
  smooth: 'cubic-bezier(0.33, 0, 0.67, 1)',
  /** Bounce-settle for crown landing. */
  settle: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
};

/**
 * GPU-friendly transition string for position movement via transform.
 * Use `transform: translate(x, y)` instead of `left/top` for 60fps compositing.
 *
 * @param {number} durationMs - transition duration
 * @param {string} [easing=EASING.smooth] - CSS easing function
 * @returns {string} CSS transition value
 */
export function translateTransition(durationMs, easing = EASING.smooth) {
  return `transform ${durationMs}ms ${easing}`;
}

/**
 * Smooth lerp with easeInOutCubic curve (for JS-driven animations).
 * Returns a value between 0 and 1.
 *
 * @param {number} t - progress 0..1
 * @returns {number} eased progress 0..1
 */
export function easeInOutCubic(t) {
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Compute interpolated position between two points with easing.
 *
 * @param {number} progress - 0..1 linear progress
 * @param {{x: number, y: number}} from - start position
 * @param {{x: number, y: number}} to - end position
 * @param {function} [easeFn=easeInOutCubic] - easing function
 * @returns {{x: number, y: number}} interpolated position
 */
export function lerpPosition(progress, from, to, easeFn = easeInOutCubic) {
  const t = easeFn(Math.max(0, Math.min(1, progress)));
  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
  };
}
