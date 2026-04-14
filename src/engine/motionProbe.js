/**
 * motionProbe — runtime detection of the user's motion preferences and
 * the browser's actual willingness to play CSS keyframe animations.
 *
 * Returns one of three modes:
 *
 *   'full'    — animations work as designed.
 *   'reduced' — `prefers-reduced-motion: reduce` is set. We snap to final
 *               states / use very short fades.
 *   'none'    — CSS animations are disabled at the browser level (corp
 *               policy, accessibility extension, user stylesheet with
 *               `* { animation: none !important }`). The JS-driven motion
 *               pipeline becomes the sole driver; CSS-only flourishes get
 *               skipped.
 *
 * Detection is one-shot per page load. The result is cached because the
 * probe touches the DOM and we don't want to repeat that on every render.
 * Tests + hot reload can call `resetMotionProbe()` to re-run detection.
 */

let cachedMode = null;

function reducedMotionPreferred() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches === true;
  } catch {
    return false;
  }
}

function cssAnimationsDisabled() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  if (!document.body || !document.head) return false;

  let styleEl = null;
  let probeEl = null;
  try {
    styleEl = document.createElement('style');
    styleEl.setAttribute('data-motion-probe', '');
    styleEl.textContent =
      '@keyframes __motion_probe_kf { from { opacity: 1; } to { opacity: 0.5; } }';
    document.head.appendChild(styleEl);

    probeEl = document.createElement('div');
    probeEl.setAttribute('aria-hidden', 'true');
    probeEl.style.cssText =
      'position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;' +
      'pointer-events:none;animation:__motion_probe_kf 1ms linear forwards;';
    document.body.appendChild(probeEl);

    const computed = window.getComputedStyle(probeEl);
    const animName = computed.animationName;
    const animDuration = computed.animationDuration;

    // If the browser refused our animation, the computed name resolves to
    // 'none' (e.g. when the user has a global animation-disable stylesheet)
    // or the duration is zero.
    return (
      !animName
      || animName === 'none'
      || animDuration === '0s'
      || animDuration === '0ms'
    );
  } catch {
    // If we can't probe (jsdom, sandboxed iframe), assume animations work.
    return false;
  } finally {
    if (probeEl && probeEl.parentNode) probeEl.parentNode.removeChild(probeEl);
    if (styleEl && styleEl.parentNode) styleEl.parentNode.removeChild(styleEl);
  }
}

function detect() {
  if (reducedMotionPreferred()) return 'reduced';
  if (cssAnimationsDisabled()) return 'none';
  return 'full';
}

/**
 * Get the current motion mode. Detection runs once and is cached.
 *
 * @returns {'full' | 'reduced' | 'none'}
 */
export function getMotionMode() {
  if (cachedMode == null) cachedMode = detect();
  return cachedMode;
}

/**
 * Force the cached motion mode (tests, demos, debug overrides).
 */
export function setMotionMode(mode) {
  if (mode !== 'full' && mode !== 'reduced' && mode !== 'none') {
    throw new Error(`setMotionMode: invalid mode ${mode}`);
  }
  cachedMode = mode;
}

/**
 * Discard the cached value so the next `getMotionMode()` call re-probes.
 * Useful in tests.
 */
export function resetMotionProbe() {
  cachedMode = null;
}
