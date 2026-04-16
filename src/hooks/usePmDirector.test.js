/**
 * usePmDirector tests — the anti-handoff regression.
 *
 * The whole refactor exists to kill the teleport between the PM's idle
 * walk and the first ceremony frame. That teleport used to be caused by
 * `ceremonyStartPos` being captured via a useEffect that raced the first
 * ceremony render, leaving it `null` and triggering a `vh-140` fallback
 * in `computeCrownRemoval`.
 *
 * This suite pins the fix: `ceremonyStartPos` must reflect the PM
 * character's live position the very render that `ceremonyActive` flips
 * on — captured synchronously during render, not after commit.
 */

import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePmDirector, computeIdleCenter, IDLE_CYCLE_MS } from './usePmDirector';
import { createStageRuntime } from './useCharacterStage';
import { setMotionMode, resetMotionProbe } from '../engine/motionProbe';
import { __testing__ as motionTesting } from '../engine/MotionRuntime';
import { getIdleWalkBounds, SPRITE_W, SPRITE_H } from '../engine/characterLayout';

beforeEach(() => {
  setMotionMode('reduced'); // keep rAF quiet in the hook; we drive state manually
});

afterEach(() => {
  resetMotionProbe();
  motionTesting.reset();
});

describe('computeIdleCenter', () => {
  const vw = 1440;
  const { minX, maxX } = getIdleWalkBounds(vw);

  it('holds at left edge during the start hold window', () => {
    const p = computeIdleCenter(0, vw);
    expect(p.x).toBe(minX);
    expect(p.facingLeft).toBe(false);
  });

  it('reaches right edge at 47% of cycle facing right', () => {
    const p = computeIdleCenter(IDLE_CYCLE_MS * 0.47, vw);
    expect(p.x).toBeCloseTo(maxX, 0);
    expect(p.facingLeft).toBe(false);
  });

  it('flips to facing-left between 47% and 53%', () => {
    const before = computeIdleCenter(IDLE_CYCLE_MS * 0.49, vw);
    const after = computeIdleCenter(IDLE_CYCLE_MS * 0.51, vw);
    expect(before.facingLeft).toBe(false);
    expect(after.facingLeft).toBe(true);
  });

  it('wraps around past one full cycle', () => {
    const half = computeIdleCenter(IDLE_CYCLE_MS * 0.25, vw);
    const wrapped = computeIdleCenter(IDLE_CYCLE_MS * 1.25, vw);
    expect(wrapped.x).toBeCloseTo(half.x, 5);
    expect(wrapped.facingLeft).toBe(half.facingLeft);
  });

  it('emits center-coord X (top-left + SPRITE_W/2 of old code)', () => {
    // Old usePmPosition returned top-left x = 10 at cycle start.
    // New center-convention: center x = 10 + SPRITE_W/2.
    const p = computeIdleCenter(0, vw);
    expect(p.x).toBe(10 + SPRITE_W / 2);
  });
});

describe('usePmDirector — ceremonyStartPos snapshot', () => {
  it('is null while ceremonyActive is false', () => {
    const stage = createStageRuntime();
    const { result } = renderHook(({ active }) =>
      usePmDirector({ stage, ceremonyActive: active }),
    { initialProps: { active: false } });
    expect(result.current.ceremonyStartPos).toBeNull();
  });

  it('captures the live PM position synchronously when ceremonyActive flips on', () => {
    const stage = createStageRuntime();
    const { result, rerender } = renderHook(({ active }) =>
      usePmDirector({ stage, ceremonyActive: active }),
    { initialProps: { active: false } });

    // Simulate an in-flight idle frame: mutate pmChar.position directly, as
    // the rAF loop would. Under reduced motion the hook's own idle loop is
    // a no-op after teleporting to minX — so we freely overwrite.
    const pmChar = result.current.pmChar;
    expect(pmChar).not.toBeNull();
    pmChar.position = { x: 742, y: 830 };
    pmChar.facingLeft = true;

    // Flip ceremonyActive — the snapshot must be { 742, 830 }, not a
    // fallback (vw/2, vh-140) and not null.
    rerender({ active: true });
    expect(result.current.ceremonyStartPos).toEqual({ x: 742, y: 830 });
  });

  it('clears the snapshot when ceremony ends', () => {
    const stage = createStageRuntime();
    const { result, rerender } = renderHook(({ active }) =>
      usePmDirector({ stage, ceremonyActive: active }),
    { initialProps: { active: false } });
    result.current.pmChar.position = { x: 500, y: 800 };
    rerender({ active: true });
    expect(result.current.ceremonyStartPos).not.toBeNull();
    rerender({ active: false });
    expect(result.current.ceremonyStartPos).toBeNull();
  });

  it('does not resnapshot on successive renders while the ceremony is already active', () => {
    const stage = createStageRuntime();
    const { result, rerender } = renderHook(({ active }) =>
      usePmDirector({ stage, ceremonyActive: active }),
    { initialProps: { active: false } });
    result.current.pmChar.position = { x: 300, y: 800 };
    rerender({ active: true });
    const firstSnapshot = result.current.ceremonyStartPos;

    // Pretend another hook's tick moved the PM mid-ceremony (e.g. ceremony
    // mirror walking to the leader). The snapshot must not follow — that's
    // the whole point of capturing ceremonyStartPos once, at the boundary.
    result.current.pmChar.position = { x: 900, y: 800 };
    rerender({ active: true });
    expect(result.current.ceremonyStartPos).toEqual(firstSnapshot);
  });
});

describe('usePmDirector — character lifecycle', () => {
  it('creates a single PM character on the stage', () => {
    const stage = createStageRuntime();
    renderHook(() => usePmDirector({ stage, ceremonyActive: false }));
    expect(stage.size()).toBe(1);
    expect(stage.has('pm')).toBe(true);
  });

  it('reuses the same character across rerenders (no mount churn)', () => {
    const stage = createStageRuntime();
    const { result, rerender } = renderHook(({ active }) =>
      usePmDirector({ stage, ceremonyActive: active }),
    { initialProps: { active: false } });
    const first = result.current.pmChar;
    rerender({ active: true });
    rerender({ active: false });
    rerender({ active: true });
    expect(result.current.pmChar).toBe(first);
  });

  it('ceremony mirror copies phaseState.pmCeremonyPosition into the character', () => {
    const stage = createStageRuntime();
    const phaseStateRef = { current: null };
    const { rerender } = renderHook(({ active }) =>
      usePmDirector({ stage, ceremonyActive: active, phaseStateRef }),
    { initialProps: { active: false } });

    phaseStateRef.current = {
      pmCeremonyPosition: { x: 600, y: 400 },
      pmCeremonyPose: 'walk1',
      pmCeremonyFacing: 'left',
      pmCeremonyBubble: null,
    };
    rerender({ active: true });

    const pmChar = stage.get('pm');
    expect(pmChar.position).toEqual({ x: 600, y: 400 });
    expect(pmChar.pose).toBe('walk1');
    expect(pmChar.facingLeft).toBe(true);
  });

  it('ceremony mirror prefers roomStartState.pmPosition when active', () => {
    const stage = createStageRuntime();
    const phaseStateRef = { current: null };
    const roomStartStateRef = { current: null };
    const { rerender } = renderHook(({ active }) =>
      usePmDirector({
        stage,
        ceremonyActive: active,
        phaseStateRef,
        roomStartStateRef,
      }),
    { initialProps: { active: false } });

    roomStartStateRef.current = {
      active: true,
      pmPosition: { x: 200, y: 500 },
      pmPose: 'cast',
    };
    phaseStateRef.current = {
      pmCeremonyPosition: { x: 9999, y: 9999 },
      pmCeremonyPose: 'walk1',
      pmCeremonyFacing: 'left',
      pmCeremonyBubble: null,
    };
    rerender({ active: true });
    expect(stage.get('pm').position).toEqual({ x: 200, y: 500 });
    expect(stage.get('pm').pose).toBe('cast');
  });
});

describe('SPRITE_H is exported so tests can compute ground-relative coords', () => {
  it('is the 14-row × 5px sprite height', () => {
    expect(SPRITE_H).toBe(70);
  });
});
