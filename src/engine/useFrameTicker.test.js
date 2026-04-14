import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFrameTicker, useFrameToggle, useAnimationFrame } from './useFrameTicker';
import { __testing__ } from './MotionRuntime';

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

describe('useFrameTicker', () => {
  beforeEach(() => {
    installRaf();
    __testing__.reset();
    nowOverride = 1000;
    performance.now = () => nowOverride;
  });

  afterEach(() => {
    __testing__.reset();
    performance.now = realPerformanceNow;
  });

  it('fires the callback at most every intervalMs', () => {
    const cb = vi.fn();
    renderHook(() => useFrameTicker(100, cb));

    // First frame primes lastFireRef and fires immediately.
    act(() => { setNow(1000); flushFrame(); });
    expect(cb).toHaveBeenCalledTimes(1);

    // 50ms later — too soon, no fire.
    act(() => { setNow(1050); flushFrame(); });
    expect(cb).toHaveBeenCalledTimes(1);

    // 110ms after first fire — should fire.
    act(() => { setNow(1110); flushFrame(); });
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it('respects enabled=false and stops subscribing', () => {
    const cb = vi.fn();
    const { rerender } = renderHook(({ on }) => useFrameTicker(50, cb, on), {
      initialProps: { on: true },
    });
    act(() => { setNow(2000); flushFrame(); });
    expect(cb).toHaveBeenCalledTimes(1);

    rerender({ on: false });
    act(() => { setNow(3000); flushFrame(); });
    expect(cb).toHaveBeenCalledTimes(1);
  });
});

describe('useFrameToggle', () => {
  beforeEach(() => {
    installRaf();
    __testing__.reset();
    nowOverride = 1000;
    performance.now = () => nowOverride;
  });

  afterEach(() => {
    __testing__.reset();
    performance.now = realPerformanceNow;
  });

  it('flips between 0 and 1 each interval', () => {
    const { result } = renderHook(() => useFrameToggle(100));
    expect(result.current).toBe(0);

    act(() => { setNow(1000); flushFrame(); });
    // First fire flips to 1
    expect(result.current).toBe(1);

    act(() => { setNow(1110); flushFrame(); });
    expect(result.current).toBe(0);

    act(() => { setNow(1220); flushFrame(); });
    expect(result.current).toBe(1);
  });
});

describe('useAnimationFrame', () => {
  beforeEach(() => {
    installRaf();
    __testing__.reset();
    nowOverride = 0;
    performance.now = () => nowOverride;
  });

  afterEach(() => {
    __testing__.reset();
    performance.now = realPerformanceNow;
  });

  it('fires every frame while enabled', () => {
    const cb = vi.fn();
    renderHook(() => useAnimationFrame(cb));

    act(() => { setNow(16); flushFrame(); });
    act(() => { setNow(32); flushFrame(); });
    act(() => { setNow(48); flushFrame(); });

    expect(cb).toHaveBeenCalledTimes(3);
  });

  it('unsubscribes on unmount', () => {
    const cb = vi.fn();
    const { unmount } = renderHook(() => useAnimationFrame(cb));
    act(() => { setNow(16); flushFrame(); });
    expect(cb).toHaveBeenCalledTimes(1);

    unmount();
    act(() => { setNow(32); flushFrame(); });
    expect(cb).toHaveBeenCalledTimes(1);
  });
});
