import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePmModel } from './usePmModel';
import { __testing__ as motionTesting } from '../engine/MotionRuntime';

let rafQueue = [];
let rafCounter = 0;

function installRaf() {
  rafQueue = [];
  rafCounter = 0;
  globalThis.requestAnimationFrame = (cb) => {
    rafCounter += 1;
    const id = rafCounter;
    rafQueue.push({ id, cb });
    return id;
  };
  globalThis.cancelAnimationFrame = (id) => {
    rafQueue = rafQueue.filter((entry) => entry.id !== id);
  };
}

let nowOverride = 0;
const realPerformanceNow = performance.now.bind(performance);

function setNow(t) { nowOverride = t; }

function flushFrame() {
  const queued = rafQueue;
  rafQueue = [];
  for (const entry of queued) entry.cb(nowOverride);
}

describe('usePmModel', () => {
  beforeEach(() => {
    installRaf();
    motionTesting.reset();
    nowOverride = 1000;
    performance.now = () => nowOverride;
  });

  afterEach(() => {
    motionTesting.reset();
    performance.now = realPerformanceNow;
    vi.restoreAllMocks();
  });

  it('toggles walkFrame when not casting', () => {
    const { result } = renderHook(() => usePmModel({ mode: 'idle' }));
    expect(result.current.walkFrame).toBe(0);
    act(() => { setNow(1000); flushFrame(); });
    expect(result.current.walkFrame).toBe(1);
    act(() => { setNow(1600); flushFrame(); });
    expect(result.current.walkFrame).toBe(0);
  });

  it('freezes walkFrame and forces cast pose while casting', () => {
    const { result, rerender } = renderHook(
      ({ casting }) => usePmModel({ mode: 'idle', isCasting: casting }),
      { initialProps: { casting: false } }
    );
    act(() => { setNow(1000); flushFrame(); });
    const frameBefore = result.current.walkFrame;

    rerender({ casting: true });
    act(() => { setNow(2000); flushFrame(); });
    expect(result.current.pose).toBe('cast');
    // walkFrame should not change while frozen
    expect(result.current.walkFrame).toBe(frameBefore);
  });

  it('fires onCastComplete after the sparkle window', () => {
    vi.useFakeTimers();
    const onCastComplete = vi.fn();
    const { rerender } = renderHook(
      ({ casting }) => usePmModel({ mode: 'idle', isCasting: casting, onCastComplete }),
      { initialProps: { casting: false } }
    );
    rerender({ casting: true });
    expect(onCastComplete).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1500); });
    expect(onCastComplete).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('non-leader idle PM with externalQuote shows think pose + bubble', () => {
    const { result } = renderHook(() => usePmModel({
      mode: 'idle',
      isLeader: false,
      externalQuote: 'Per my last email...',
    }));
    expect(result.current.pose).toBe('think');
    expect(result.current.showBubble).toBe(true);
    expect(result.current.bubble).toBe('Per my last email...');
  });

  it('ceremony mode maps pmPose=cast to cast pose and pmBubble to bubble', () => {
    const { result } = renderHook(() => usePmModel({
      mode: 'ceremony',
      pmPose: 'cast',
      pmBubble: 'BEHOLD',
      ceremonyFacing: 'left',
    }));
    expect(result.current.pose).toBe('cast');
    expect(result.current.bubble).toBe('BEHOLD');
    expect(result.current.showBubble).toBe(true);
    expect(result.current.facingLeft).toBe(true);
  });

  it('ceremony mode without pmPose still toggles walkFrame', () => {
    const { result } = renderHook(() => usePmModel({
      mode: 'ceremony',
      pmPose: null,
      ceremonyFacing: 'right',
    }));
    expect(result.current.pose).toBe('walk');
    act(() => { setNow(1000); flushFrame(); });
    expect(result.current.walkFrame).toBe(1);
  });

  it('leader thinking loop only runs in idle mode', () => {
    const onQuote = vi.fn();
    renderHook(() => usePmModel({
      mode: 'ceremony',
      isLeader: true,
      onQuote,
    }));
    // Even if we burn many frames, ceremony-mode PM never publishes quotes
    for (let i = 0; i < 50; i++) {
      act(() => { setNow(1000 + i * 100); flushFrame(); });
    }
    expect(onQuote).not.toHaveBeenCalled();
  });

  it('clears externalQuote bubble for non-leader when externalQuote becomes empty', () => {
    const { result, rerender } = renderHook(
      ({ q }) => usePmModel({ mode: 'idle', externalQuote: q, isLeader: false }),
      { initialProps: { q: 'Hello' } }
    );
    expect(result.current.showBubble).toBe(true);
    rerender({ q: '' });
    expect(result.current.showBubble).toBe(false);
    expect(result.current.pose).toBe('walk');
  });
});
