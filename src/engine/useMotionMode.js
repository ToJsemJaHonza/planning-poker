import { useEffect, useState } from 'react';
import { getMotionMode, resetMotionProbe } from './motionProbe';

/**
 * React hook returning the active motion mode ('full' | 'reduced' | 'none').
 *
 * Listens for changes to the `prefers-reduced-motion` media query so the UI
 * snaps to compressed phase tables the moment the user toggles the OS
 * accessibility setting (no page reload required).
 */
export function useMotionMode() {
  const [mode, setMode] = useState(getMotionMode);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }
    let mql;
    try {
      mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    } catch {
      return undefined;
    }

    const handler = () => {
      // Re-probe so we pick up `none` if a stylesheet just disabled animations,
      // or revert to `full` if reduced-motion was switched off.
      resetMotionProbe();
      setMode(getMotionMode());
    };

    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', handler);
      return () => mql.removeEventListener('change', handler);
    }
    if (typeof mql.addListener === 'function') {
      // Safari < 14
      mql.addListener(handler);
      return () => mql.removeListener(handler);
    }
    return undefined;
  }, []);

  return mode;
}
