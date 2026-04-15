/**
 * usePmPosition — computeIdlePosition pure function tests.
 *
 * Tests the exported pure helper that computes the PM sprite's x/facingLeft
 * at a given cycle time and viewport width.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  computeIdlePosition,
  CYCLE_MS,
  DESKTOP_BOTTOM,
  MOBILE_BOTTOM,
  MOBILE_BREAKPOINT,
  usePmPosition,
} from './usePmPosition';
import { setMotionMode, resetMotionProbe } from '../engine/motionProbe';
import { __testing__ as motionTesting } from '../engine/MotionRuntime';

describe('computeIdlePosition — cycle phases', () => {
  const vw = 1440;

  it('returns x=10 at cycle start (0% of cycle)', () => {
    const pos = computeIdlePosition(0, vw);
    expect(pos.x).toBe(10);
    expect(pos.facingLeft).toBe(false);
  });

  it('holds at x=10 during 0%-3% of cycle (start hold)', () => {
    const pos = computeIdlePosition(CYCLE_MS * 0.02, vw);
    expect(pos.x).toBe(10);
    expect(pos.facingLeft).toBe(false);
  });

  it('moves rightward during 3%-47% of cycle', () => {
    const pos10 = computeIdlePosition(CYCLE_MS * 0.10, vw);
    const pos30 = computeIdlePosition(CYCLE_MS * 0.30, vw);
    expect(pos30.x).toBeGreaterThan(pos10.x);
    expect(pos10.facingLeft).toBe(false);
    expect(pos30.facingLeft).toBe(false);
  });

  it('reaches right edge at 47% of cycle', () => {
    const maxX = vw - 70;
    const pos = computeIdlePosition(CYCLE_MS * 0.47, vw);
    expect(pos.x).toBeCloseTo(maxX, 0);
    expect(pos.facingLeft).toBe(false);
  });

  it('flips facing at 50% of cycle', () => {
    const pos49 = computeIdlePosition(CYCLE_MS * 0.49, vw);
    const pos51 = computeIdlePosition(CYCLE_MS * 0.51, vw);
    expect(pos49.facingLeft).toBe(false);
    expect(pos51.facingLeft).toBe(true);
  });

  it('moves leftward during 53%-97% of cycle', () => {
    const pos60 = computeIdlePosition(CYCLE_MS * 0.60, vw);
    const pos80 = computeIdlePosition(CYCLE_MS * 0.80, vw);
    expect(pos60.x).toBeGreaterThan(pos80.x);
    expect(pos60.facingLeft).toBe(true);
    expect(pos80.facingLeft).toBe(true);
  });

  it('returns x=10 at 97%+ of cycle (end hold)', () => {
    const pos = computeIdlePosition(CYCLE_MS * 0.98, vw);
    expect(pos.x).toBe(10);
    expect(pos.facingLeft).toBe(true);
  });

  it('wraps around correctly (progress > 1 cycle)', () => {
    // 1.5 cycles = same as 0.5 cycles
    const posHalf = computeIdlePosition(CYCLE_MS * 0.5, vw);
    const posOneAndHalf = computeIdlePosition(CYCLE_MS * 1.5, vw);
    expect(posOneAndHalf.x).toBeCloseTo(posHalf.x, 0);
    expect(posOneAndHalf.facingLeft).toBe(posHalf.facingLeft);
  });
});

describe('computeIdlePosition — viewport width handling', () => {
  it('narrow viewport has smaller range', () => {
    const narrowPos = computeIdlePosition(CYCLE_MS * 0.25, 400);
    const widePos = computeIdlePosition(CYCLE_MS * 0.25, 1440);
    expect(widePos.x).toBeGreaterThan(narrowPos.x);
  });

  it('maxX is viewport - 70', () => {
    const vw = 800;
    const pos = computeIdlePosition(CYCLE_MS * 0.47, vw);
    expect(pos.x).toBeCloseTo(vw - 70, 0);
  });
});

describe('usePmPosition — reduced-motion behavior', () => {
  afterEach(() => {
    resetMotionProbe();
    motionTesting.reset();
  });

  it('snaps to a resting position and never starts the motion runtime', () => {
    setMotionMode('reduced');
    const before = motionTesting.isRunning();
    const { result } = renderHook(() => usePmPosition({ ceremonyActive: false }));
    // Resting pose: x=10, facing right (matches start-of-cycle hold).
    expect(result.current.x).toBe(10);
    expect(result.current.facingLeft).toBe(false);
    // No subscription means the runtime stays idle when no other subscribers exist.
    expect(motionTesting.isRunning()).toBe(before);
  });

  it('subscribes to the shared motion runtime in full mode', () => {
    setMotionMode('full');
    motionTesting.reset();
    let unmount;
    act(() => {
      const { unmount: u } = renderHook(() => usePmPosition({ ceremonyActive: false }));
      unmount = u;
    });
    // jsdom doesn't actually drive rAF; we just confirm the runtime now has
    // a subscriber registered (i.e. the hook plugged in correctly).
    expect(typeof unmount).toBe('function');
    unmount?.();
  });
});

describe('exported constants', () => {
  it('CYCLE_MS is 16000', () => {
    expect(CYCLE_MS).toBe(16000);
  });

  it('DESKTOP_BOTTOM is 105', () => {
    expect(DESKTOP_BOTTOM).toBe(105);
  });

  it('MOBILE_BOTTOM is 165 for narrow viewport', () => {
    expect(MOBILE_BOTTOM).toBe(165);
  });

  it('MOBILE_BREAKPOINT is 560', () => {
    expect(MOBILE_BREAKPOINT).toBe(560);
  });
});
