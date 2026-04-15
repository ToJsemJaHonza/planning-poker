/**
 * useOktaKeys — extracted easter-egg keyboard hook.
 *
 * Behaviour migrated from Room.jsx — these tests pin down the original
 * contract so the extraction can't silently change semantics:
 *   - Only fires when the local playerName is "Honza" (case-insensitive)
 *   - Requires all four bare letters O+K+T+A held simultaneously
 *   - Modifier-key presses (Ctrl/Cmd/Alt) are ignored
 *   - Auto-repeat presses do NOT count
 *   - The trigger fires AT MOST once per combo (then resets)
 *   - Removing the hook detaches its window listeners
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useOktaKeys } from './useOktaKeys';

function press(key, init = {}) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, ...init }));
}
function release(key) {
  window.dispatchEvent(new KeyboardEvent('keyup', { key }));
}

describe('useOktaKeys — gating', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('does nothing when playerName is not "honza"', () => {
    const onTrigger = vi.fn();
    renderHook(() => useOktaKeys({ playerName: 'Alice', onTrigger }));
    press('o'); press('k'); press('t'); press('a');
    expect(onTrigger).not.toHaveBeenCalled();
  });

  it('does nothing when enabled=false', () => {
    const onTrigger = vi.fn();
    renderHook(() => useOktaKeys({ playerName: 'Honza', onTrigger, enabled: false }));
    press('o'); press('k'); press('t'); press('a');
    expect(onTrigger).not.toHaveBeenCalled();
  });

  it('matches "Honza" case-insensitively', () => {
    const onTrigger = vi.fn();
    renderHook(() => useOktaKeys({ playerName: 'HoNzA', onTrigger }));
    press('o'); press('k'); press('t'); press('a');
    expect(onTrigger).toHaveBeenCalledTimes(1);
  });
});

describe('useOktaKeys — combo behaviour', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('fires when all four letters are pressed in any order', () => {
    const onTrigger = vi.fn();
    renderHook(() => useOktaKeys({ playerName: 'Honza', onTrigger }));
    press('a'); press('t'); press('o'); press('k');
    expect(onTrigger).toHaveBeenCalledTimes(1);
  });

  it('does NOT fire while a modifier key is held (Ctrl+O+K+T+A)', () => {
    const onTrigger = vi.fn();
    renderHook(() => useOktaKeys({ playerName: 'Honza', onTrigger }));
    press('o', { ctrlKey: true });
    press('k', { ctrlKey: true });
    press('t', { ctrlKey: true });
    press('a', { ctrlKey: true });
    expect(onTrigger).not.toHaveBeenCalled();
  });

  it('ignores keyboard auto-repeat (e.repeat === true)', () => {
    const onTrigger = vi.fn();
    renderHook(() => useOktaKeys({ playerName: 'Honza', onTrigger }));
    press('o'); press('k'); press('t');
    press('a', { repeat: true }); // last key is a held-key repeat
    expect(onTrigger).not.toHaveBeenCalled();
  });

  it('only fires once per combo — pressing again after the trigger requires a fresh combo', () => {
    const onTrigger = vi.fn();
    renderHook(() => useOktaKeys({ playerName: 'Honza', onTrigger }));
    press('o'); press('k'); press('t'); press('a');
    expect(onTrigger).toHaveBeenCalledTimes(1);
    // After the trigger the pressed set is cleared. A single extra "a"
    // shouldn't re-trigger.
    press('a');
    expect(onTrigger).toHaveBeenCalledTimes(1);
  });

  it('clears the pressed set 2s after the last keypress (timeout-based reset)', () => {
    const onTrigger = vi.fn();
    renderHook(() => useOktaKeys({ playerName: 'Honza', onTrigger }));
    press('o'); press('k'); press('t');
    vi.advanceTimersByTime(2100);
    // Buffer cleared — pressing 'a' alone shouldn't fire.
    press('a');
    expect(onTrigger).not.toHaveBeenCalled();
  });

  it('detaches listeners on unmount (no trigger after teardown)', () => {
    const onTrigger = vi.fn();
    const { unmount } = renderHook(() => useOktaKeys({ playerName: 'Honza', onTrigger }));
    unmount();
    press('o'); press('k'); press('t'); press('a');
    expect(onTrigger).not.toHaveBeenCalled();
  });

  it('keyup removes a key from the pressed set so it must be re-pressed', () => {
    const onTrigger = vi.fn();
    renderHook(() => useOktaKeys({ playerName: 'Honza', onTrigger }));
    press('o');
    release('o');
    press('k'); press('t'); press('a'); // missing 'o'
    expect(onTrigger).not.toHaveBeenCalled();
    press('o');
    expect(onTrigger).toHaveBeenCalledTimes(1);
  });
});
