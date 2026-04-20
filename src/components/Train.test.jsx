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

    // Push past 10600ms (onPlayerExit trigger in the new 14-phase timeline) in total.
    act(() => { vi.advanceTimersByTime(6000); });

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

    // onDone fires at t=13500 in the 14-phase timeline.
    act(() => { vi.advanceTimersByTime(14000); });

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

    // Advance past the arrive timer (1800ms)
    act(() => { vi.advanceTimersByTime(5500); });
    // Now re-render with brand-new callbacks — the old bug would restart timers here
    rerender(
      <Train
        fromRight={true}
        playerName="Ricardo"
        onPlayerExit={() => onPlayerExit()}
        onDone={() => onDone()}
      />
    );
    // Advance enough total time to fire onPlayerExit (10600ms in the new timeline).
    act(() => { vi.advanceTimersByTime(6000); });

    // If the timers had restarted on rerender, we'd still be pre-exit and
    // onPlayerExit wouldn't have been called yet.
    expect(onPlayerExit).toHaveBeenCalledTimes(1);
  });

  it('renders the station sign during the approach beat', () => {
    const { queryByTestId } = render(
      <Train
        fromRight={false}
        playerName="Richard"
        onPlayerExit={() => {}}
        onDone={() => {}}
      />
    );
    // Before approach (t < 400) the station sign is not mounted.
    expect(queryByTestId('train-station-sign')).toBeNull();
    // After approach begins, the sign is on screen.
    act(() => { vi.advanceTimersByTime(500); });
    expect(queryByTestId('train-station-sign')).not.toBeNull();
  });

  it('shows a horn bubble at the horn beat', () => {
    const { queryByTestId } = render(
      <Train
        fromRight={false}
        playerName="Richard"
        onPlayerExit={() => {}}
        onDone={() => {}}
      />
    );
    // Horn phase starts at t=1200.
    act(() => { vi.advanceTimersByTime(1300); });
    expect(queryByTestId('train-horn-bubble')).not.toBeNull();
    expect(queryByTestId('train-steam-cloud')).not.toBeNull();
  });

  it('renders a door flash during the doorsOpen beat', () => {
    const { queryByTestId } = render(
      <Train
        fromRight={false}
        playerName="Richard"
        onPlayerExit={() => {}}
        onDone={() => {}}
      />
    );
    // Before doorsOpen (t < 5100) no flash.
    act(() => { vi.advanceTimersByTime(5000); });
    expect(queryByTestId('train-door-flash')).toBeNull();
    // During doorsOpen.
    act(() => { vi.advanceTimersByTime(200); });
    expect(queryByTestId('train-door-flash')).not.toBeNull();
  });

  it('shows a goodbye wave bubble at the wave beat', () => {
    const { queryByTestId } = render(
      <Train
        fromRight={false}
        playerName="Richard"
        onPlayerExit={() => {}}
        onDone={() => {}}
      />
    );
    // Wave phase starts at t=9000.
    act(() => { vi.advanceTimersByTime(9100); });
    expect(queryByTestId('train-wave-bubble')).not.toBeNull();
  });

  it('draws 3 pantograph decorations once the train is on screen', () => {
    const { container } = render(
      <Train
        fromRight={false}
        playerName="Richard"
        onPlayerExit={() => {}}
        onDone={() => {}}
      />
    );
    // After arrive phase kicks in, the train is mounted.
    act(() => { vi.advanceTimersByTime(2000); });
    const pantographs = container.querySelectorAll('[data-testid="train-pantograph"]');
    expect(pantographs.length).toBe(3);
  });
});
