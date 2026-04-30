import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGridTop } from './useGridTop';
import { DEFAULT_GRID_TOP } from './gridPosition';

function makeRef(top) {
  // Ref to a fake element with a stable getBoundingClientRect.
  let currentTop = top;
  const node = {
    getBoundingClientRect: () => ({
      top: currentTop,
      left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: currentTop,
    }),
    setTop(v) { currentTop = v; },
  };
  return {
    ref: { current: node },
    setTop: (v) => node.setTop(v),
  };
}

describe('useGridTop', () => {
  let originalRO;
  let observers;

  beforeEach(() => {
    observers = [];
    originalRO = globalThis.ResizeObserver;
    // Capture observed elements + the callback so tests can fire it
    // synthetically. jsdom doesn't ship ResizeObserver natively.
    globalThis.ResizeObserver = class {
      constructor(cb) { this.cb = cb; observers.push(this); }
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  afterEach(() => {
    if (originalRO) globalThis.ResizeObserver = originalRO;
    else delete globalThis.ResizeObserver;
    vi.restoreAllMocks();
  });

  it('returns the ref element\'s viewport top after the rAF flush', async () => {
    const { ref } = makeRef(312);
    const { result } = renderHook(() => useGridTop(ref));

    // Initial state is the legacy default; the rAF flush replaces it
    // with the measured value.
    expect(result.current).toBe(DEFAULT_GRID_TOP);

    // Drain any pending requestAnimationFrame callbacks.
    await act(async () => {
      await new Promise((r) => requestAnimationFrame(r));
    });

    expect(result.current).toBe(312);
  });

  it('falls back to DEFAULT_GRID_TOP when no ref is given', () => {
    const { result } = renderHook(() => useGridTop(null));
    expect(result.current).toBe(DEFAULT_GRID_TOP);
  });

  it('updates when ResizeObserver fires (e.g. TaskBar list mode toggling)', async () => {
    const { ref, setTop } = makeRef(300);
    const { result } = renderHook(() => useGridTop(ref));

    await act(async () => { await new Promise((r) => requestAnimationFrame(r)); });
    expect(result.current).toBe(300);

    // The TaskBar gains items → bars above us grow → our `top` increases.
    setTop(420);
    await act(async () => {
      // Fire each registered observer so the hook reschedules a measure.
      for (const o of observers) o.cb([]);
      await new Promise((r) => requestAnimationFrame(r));
    });

    expect(result.current).toBe(420);
  });

  it('updates on window resize without ResizeObserver', async () => {
    delete globalThis.ResizeObserver;
    const { ref, setTop } = makeRef(180);
    const { result } = renderHook(() => useGridTop(ref));
    await act(async () => { await new Promise((r) => requestAnimationFrame(r)); });
    expect(result.current).toBe(180);

    setTop(260);
    await act(async () => {
      window.dispatchEvent(new Event('resize'));
      await new Promise((r) => requestAnimationFrame(r));
    });
    expect(result.current).toBe(260);
  });

  it('ignores non-positive measurements (very early layout passes)', async () => {
    const { ref, setTop } = makeRef(0);
    const { result } = renderHook(() => useGridTop(ref));
    await act(async () => { await new Promise((r) => requestAnimationFrame(r)); });
    // Top of zero means layout hasn't run — keep the default.
    expect(result.current).toBe(DEFAULT_GRID_TOP);

    setTop(155);
    await act(async () => {
      for (const o of observers) o.cb([]);
      await new Promise((r) => requestAnimationFrame(r));
    });
    expect(result.current).toBe(155);
  });
});
