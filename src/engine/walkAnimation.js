/**
 * walkAnimation — pure helpers for computing the JS-driven walk-in/out
 * transform of a player figure.
 *
 * The CSS keyframes in `styles/walk.css` cover the happy path. These
 * helpers exist so the same motion still happens when:
 *
 *   - The user has installed an extension/stylesheet that disables
 *     `animation` globally (motionMode === 'none').
 *   - We need to snap a figure to its final state for reduced motion.
 *
 * Functions are stateless so they're trivial to unit test and reuse.
 */

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeInOutCubic = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/**
 * Clamp a value into [min, max].
 */
function clamp(value, min, max) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/**
 * Compute the walk transform for a given moment in time.
 *
 * @param {object} opts
 * @param {number} opts.elapsedMs   ms since the walk started
 * @param {number} opts.durationMs  total walk duration in ms
 * @param {'left'|'right'} opts.dir direction the figure walks FROM (in) or TO (out)
 * @param {'in'|'out'} opts.kind    walk-in vs walk-out semantic
 * @returns {{ transform: string, opacity: number, done: boolean }}
 */
export function walkTransformAt({ elapsedMs, durationMs, dir, kind }) {
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    return { transform: 'translateX(0)', opacity: 1, done: true };
  }
  const t = clamp(elapsedMs / durationMs, 0, 1);
  const done = t >= 1;

  if (kind === 'in') {
    // Walk in: figure starts off-screen on `dir` side and moves to 0.
    const ease = easeInOutCubic(t);
    const startVw = dir === 'left' ? -110 : 110;
    const x = startVw * (1 - ease);
    return {
      transform: `translateX(${x}vw)`,
      opacity: 1,
      done,
    };
  }

  // Walk out: figure starts at 0 and moves off-screen on `dir` side.
  const ease = easeOutCubic(t);
  const endVw = dir === 'left' ? -120 : 120;
  const x = endVw * ease;
  // Opacity holds at 1 until 85% then fades — matches the CSS keyframe.
  const opacity = t < 0.85 ? 1 : Math.max(0, 1 - (t - 0.85) / 0.15);
  return {
    transform: `translateX(${x}vw)`,
    opacity,
    done,
  };
}

/**
 * Whether the JS-driven walk transform should override CSS for the current
 * motion mode. Centralised so callers don't replicate the rule.
 *
 *   - 'full'    → CSS keyframes drive (return false).
 *   - 'reduced' → snap to final state via inline style (return true).
 *   - 'none'    → JS drives every frame (return true).
 */
export function shouldDriveWalkInJs(motionMode) {
  return motionMode === 'none' || motionMode === 'reduced';
}

/**
 * Final-state inline style for a given walk descriptor. Used when
 * motionMode === 'reduced' so we land on the resting position without
 * playing the keyframe.
 */
export function walkRestingState({ kind }) {
  if (kind === 'in') return { transform: 'translateX(0)', opacity: 1 };
  return { transform: 'translateX(0)', opacity: 0 };
}

export const __testing__ = { easeOutCubic, easeInOutCubic, clamp };
