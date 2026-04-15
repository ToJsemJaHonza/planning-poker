/**
 * MotionRuntime — single shared requestAnimationFrame loop for the whole app.
 *
 * Every animated subsystem (PM model, player models, slot machine, ambient
 * events, shame timer, entrance events) subscribes here instead of starting
 * its own rAF or setInterval. Benefits:
 *
 *   - One rAF call per frame, no matter how many things are animating.
 *   - Deterministic ordering: all subscribers see the same `now` per frame.
 *   - Tab-visibility aware: pauses when the tab is hidden, fires a single
 *     catch-up tick on resume so wall-clock-derived state can re-sync
 *     without replaying every intermediate frame.
 *   - All subscribers crash-isolated: one throwing subscriber doesn't kill
 *     the loop or other subscribers.
 *
 * The runtime is a module-scope singleton intentionally — there's only ever
 * one screen and one event loop, so there's nothing to inject.
 */

const subscribers = new Set();
let rafId = null;
let lastFrameTime = 0;

function tick() {
  rafId = null;
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  lastFrameTime = now;

  // Iterate over a snapshot so subscribers can unsubscribe mid-tick safely.
  const snapshot = Array.from(subscribers);
  for (const sub of snapshot) {
    try {
      sub(now);
    } catch (err) {
      // Crash isolation: one bad subscriber must not stop the loop.
      console.error('[MotionRuntime] subscriber threw', err);
    }
  }

  ensureRunning();
}

function ensureRunning() {
  if (rafId != null) return;
  if (subscribers.size === 0) return;
  if (typeof document !== 'undefined' && document.hidden) return;
  if (typeof requestAnimationFrame === 'undefined') return;
  rafId = requestAnimationFrame(tick);
}

/**
 * Subscribe a callback to the shared rAF loop.
 *
 * @param {(now: number) => void} callback
 *   Receives the high-resolution timestamp from performance.now().
 *   Called once per frame while the tab is visible. May be called a single
 *   "catch-up" time after the tab becomes visible again.
 * @returns {() => void} unsubscribe function
 */
export function subscribe(callback) {
  if (typeof callback !== 'function') {
    throw new Error('MotionRuntime.subscribe: callback must be a function');
  }
  subscribers.add(callback);
  ensureRunning();
  return () => {
    subscribers.delete(callback);
    if (subscribers.size === 0 && rafId != null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  };
}

/**
 * Number of currently-active subscribers. Exposed for tests.
 */
export function subscriberCount() {
  return subscribers.size;
}

/**
 * Wall-clock timestamp of the last frame the runtime fired. Useful for
 * drift detection in tests.
 */
export function lastTickAt() {
  return lastFrameTime;
}

// --- Tab visibility integration ---------------------------------------------
//
// When the tab becomes hidden, browsers throttle (or pause) rAF. Cancel our
// scheduled frame explicitly to avoid a single late firing right before the
// browser pauses — that fire would have a huge `delta` and could cause
// integer overflow in delta-based subscribers.
//
// On resume, we fire ONE synchronous tick so wall-clock-derived state
// (anything reading Date.now() to compute elapsed) gets a chance to jump
// forward and re-sync before the next paint. This avoids the "stuck train
// half way" symptom users reported.
if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (rafId != null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    } else {
      // Catch-up tick + restart loop.
      tick();
    }
  });
}

// --- Test-only escape hatch -------------------------------------------------
export const __testing__ = {
  reset() {
    subscribers.clear();
    if (rafId != null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(rafId);
    }
    rafId = null;
    lastFrameTime = 0;
  },
  forceTick() {
    tick();
  },
  isRunning() {
    return rafId != null;
  },
};
