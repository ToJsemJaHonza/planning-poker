import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useShameTimer } from './useShameTimer';

describe('useShameTimer', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('returns stage 0 for null shameTimer', () => {
    const { result } = renderHook(() => useShameTimer(null, 'player1'));
    expect(result.current.stage).toBe(0);
    expect(result.current.elapsed).toBe(0);
    expect(result.current.holdoutName).toBeNull();
    expect(result.current.isHoldout).toBe(false);
  });

  it('computes correct stage at each threshold boundary', () => {
    const now = Date.now();
    const cases = [
      { elapsed: 0,     expected: 0 },
      { elapsed: 29000, expected: 0 },
      { elapsed: 30000, expected: 1 },
      { elapsed: 44000, expected: 1 },
      { elapsed: 45000, expected: 2 },
      { elapsed: 59000, expected: 2 },
      { elapsed: 60000, expected: 3 },
      { elapsed: 79000, expected: 3 },
      { elapsed: 80000, expected: 4 },
      { elapsed: 99000, expected: 4 },
      { elapsed: 100000, expected: 5 },
      { elapsed: 200000, expected: 5 },
    ];

    for (const { elapsed, expected } of cases) {
      const timer = { holdoutName: 'Karel', holdoutId: 'p2', startedAt: now - elapsed };
      const { result } = renderHook(() => useShameTimer(timer, 'p1'));
      expect(result.current.stage).toBe(expected);
    }
  });

  it('isHoldout=true only when holdoutId matches playerId', () => {
    const timer = { holdoutName: 'Alice', holdoutId: 'alice', startedAt: Date.now() };
    const { result: r1 } = renderHook(() => useShameTimer(timer, 'alice'));
    expect(r1.current.isHoldout).toBe(true);

    const { result: r2 } = renderHook(() => useShameTimer(timer, 'bob'));
    expect(r2.current.isHoldout).toBe(false);
  });

  it('null shameTimer clears elapsed and returns stage 0', () => {
    const timer = { holdoutName: 'Karel', holdoutId: 'p2', startedAt: Date.now() - 60000 };
    const { result, rerender } = renderHook(
      ({ timer, pid }) => useShameTimer(timer, pid),
      { initialProps: { timer, pid: 'p1' } },
    );
    expect(result.current.stage).toBe(3);

    // Clear timer
    rerender({ timer: null, pid: 'p1' });
    expect(result.current.stage).toBe(0);
    expect(result.current.elapsed).toBe(0);
  });

  it('elapsed increases over time via interval', () => {
    const now = Date.now();
    const timer = { holdoutName: 'Karel', holdoutId: 'p2', startedAt: now };
    const { result } = renderHook(() => useShameTimer(timer, 'p1'));

    expect(result.current.stage).toBe(0);

    // Advance 31 seconds
    act(() => { vi.advanceTimersByTime(31000); });
    expect(result.current.stage).toBe(1);

    // Advance to 46 seconds total
    act(() => { vi.advanceTimersByTime(15000); });
    expect(result.current.stage).toBe(2);
  });
});
