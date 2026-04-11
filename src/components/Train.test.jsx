import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import Train from './Train';

describe('Train component — Richard arrival regression', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires onPlayerExit exactly once even if parent re-renders during animation', () => {
    const onPlayerExit = vi.fn();
    const onDone = vi.fn();

    const { rerender } = render(
      <Train
        fromRight={false}
        playerName="Richard"
        onPlayerExit={onPlayerExit}
        onDone={onDone}
      />
    );

    // Simulate many parent re-renders throughout the animation (which used to
    // reset the timers because the useEffect depended on onPlayerExit).
    // We pass a brand-new function reference on each render.
    for (let i = 0; i < 5; i++) {
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      rerender(
        <Train
          fromRight={false}
          playerName="Richard"
          onPlayerExit={() => onPlayerExit()}
          onDone={() => onDone()}
        />
      );
    }

    // Push past 9000ms (onPlayerExit trigger) in total
    act(() => { vi.advanceTimersByTime(5000); });

    expect(onPlayerExit).toHaveBeenCalledTimes(1);
  });

  it('fires onDone exactly once after the full animation', () => {
    const onPlayerExit = vi.fn();
    const onDone = vi.fn();

    render(
      <Train
        fromRight={false}
        playerName="Richard"
        onPlayerExit={onPlayerExit}
        onDone={onDone}
      />
    );

    act(() => { vi.advanceTimersByTime(12000); });

    expect(onPlayerExit).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('does NOT restart phases when prop callbacks change reference', () => {
    const onPlayerExit = vi.fn();
    const onDone = vi.fn();

    const { rerender } = render(
      <Train
        fromRight={true}
        playerName="Ricardo"
        onPlayerExit={onPlayerExit}
        onDone={onDone}
      />
    );

    // Advance past the first timer (800ms → arrive)
    act(() => { vi.advanceTimersByTime(4500); });
    // Now re-render with brand-new callbacks — the old bug would restart timers here
    rerender(
      <Train
        fromRight={true}
        playerName="Ricardo"
        onPlayerExit={() => onPlayerExit()}
        onDone={() => onDone()}
      />
    );
    // Advance enough total time to fire onPlayerExit (9000ms in real timeline)
    act(() => { vi.advanceTimersByTime(5000); });

    // If the timers had restarted on rerender, we'd still be at phase 'arrive'
    // and onPlayerExit wouldn't have been called yet. We verify it HAS been called.
    expect(onPlayerExit).toHaveBeenCalledTimes(1);
  });
});
