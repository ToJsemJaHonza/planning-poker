/**
 * useOktaKeys — Honza-only OKTA easter egg keyboard combo.
 *
 * Listens for O+K+T+A pressed (in any order) within a 2 second window.
 * When all four are down at once, fires the supplied trigger.
 *
 * Modifier-guarded so accidental Ctrl+O / Cmd+K combinations from
 * the user navigating the browser do NOT count toward the combo —
 * we want only the bare letter keys.
 *
 * Resets the pressed set 2s after the last keypress so a slow,
 * partial sequence (O ... long pause ... K T A) doesn't accumulate
 * and fire on the next stray keystroke.
 *
 * The 2s clear timer plus the per-keyup delete give two independent
 * cleanup paths; either alone would be enough but together they
 * survive both held-key edge cases (keyup never fires when window
 * loses focus mid-combo) and rapid taps.
 *
 * @param {object} opts
 * @param {string} opts.playerName - the local player's display name
 * @param {() => void} opts.onTrigger - fired when O+K+T+A all currently held
 * @param {boolean} [opts.enabled=true] - allow callers to short-circuit
 */

import { useEffect } from 'react';

const TRIGGER_NAME = 'honza';
const KEYS = ['o', 'k', 't', 'a'];
const CLEAR_DELAY_MS = 2000;

export function useOktaKeys({ playerName, onTrigger, enabled = true }) {
  useEffect(() => {
    if (!enabled) return undefined;
    if (!playerName || playerName.toLowerCase() !== TRIGGER_NAME) return undefined;
    if (typeof window === 'undefined') return undefined;

    const pressed = new Set();
    let clearTimer = null;

    const scheduleClear = () => {
      if (clearTimer) clearTimeout(clearTimer);
      clearTimer = setTimeout(() => pressed.clear(), CLEAR_DELAY_MS);
    };

    const check = () => {
      if (KEYS.every((k) => pressed.has(k))) {
        onTrigger?.();
        pressed.clear();
      }
    };

    const down = (e) => {
      // Reject any modified press — Ctrl+O / Cmd+K etc. are browser
      // shortcuts and should never count toward the combo. e.repeat
      // filters held-key auto-repeats so a single stuck key can't
      // satisfy the combo on its own.
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      pressed.add(e.key.toLowerCase());
      check();
      scheduleClear();
    };

    const up = (e) => {
      pressed.delete(e.key.toLowerCase());
    };

    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      if (clearTimer) clearTimeout(clearTimer);
    };
  }, [playerName, onTrigger, enabled]);
}
