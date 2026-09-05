import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createStageRuntime } from './useCharacterStage';
import { useEvictionClock, useSessionEviction } from './useSessionEviction';
import { __testing__ as motionRuntime, subscriberCount } from '../engine/MotionRuntime';
vi.mock('../engine/useMotionMode', () => ({ useMotionMode: () => mode }));
let mode = 'full';
afterEach(() => vi.useRealTimers());

describe('PM hammer stage', () => {
  it('advances queued takeovers without room-wide stage subscriptions and stops at expiry', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    const baseline = subscriberCount();
    const stage = createStageRuntime();
    stage.add({ id: 'pm', sprite: 'pm', position: { x: 100, y: 600 } });
    stage.add({ id: 'player-new', sprite: 'player', position: { x: 500, y: 240 } });
    const events = { old: { oldId: 'old', newId: 'new', playerName: 'Alice', role: 'player',
      startedAt: 1400, expiresAt: 7600, quote: 'Klon letí!' } };
    const players = { new: { name: 'Alice', role: 'player', joinedAt: 1 } };
    const hook = renderHook(() => useSessionEviction({ stage, events, players, now: useEvictionClock(events) }));
    expect(hook.result.current).toBeUndefined();
    act(() => { vi.setSystemTime(4000); motionRuntime.forceTick(); });
    expect(hook.result.current).toBe(events.old);
    expect(stage.get('pm').hammer).toBeTruthy();
    act(() => { vi.setSystemTime(7601); motionRuntime.forceTick(); });
    expect(hook.result.current).toBeUndefined();
    expect(stage.get('player-new').hidden).toBe(false);
    expect(stage.get('pm').hammer).toBeNull();
    expect(subscriberCount()).toBe(baseline);
  });
  it.each(['full', 'none', 'reduced'])('walks, strikes, ejects and releases the replacement in %s motion', motion => {
    mode = motion;
    const stage = createStageRuntime();
    stage.add({ id: 'pm', sprite: 'pm', position: { x: 100, y: 600 } });
    stage.add({ id: 'player-old', sprite: 'player', position: { x: 500, y: 240 } });
    stage.add({ id: 'player-new', sprite: 'player', position: { x: 500, y: 240 } });
    const events = { old: { oldId: 'old', newId: 'new', playerName: 'Alice', role: 'player',
      startedAt: 1000, expiresAt: 7200, quote: 'Jeden člověk, jedna židle!' } };
    const players = { new: { name: 'Alice', role: 'player', joinedAt: 1 } };
    const hook = renderHook(({ now }) => useSessionEviction({ stage, events, players, now }), { initialProps: { now: 1000 } });
    expect(stage.get('player-new').hidden).toBe(true);
    act(() => hook.rerender({ now: 3500 }));
    expect(stage.get('pm').bubble.text).toBe(events.old.quote);
    expect(stage.get('pm').hammer).toBeTruthy();
    expect(stage.get('pm').position.x).toBe(412);
    act(() => hook.rerender({ now: 4500 }));
    if (motion === 'reduced') expect(stage.get('player-old').hidden).toBe(true);
    else expect(stage.get('player-old').position.x).toBeGreaterThan(500);
    act(() => hook.rerender({ now: 7201 }));
    expect(stage.has('player-old')).toBe(false);
    expect(stage.get('player-new').hidden).toBe(false);
    expect(stage.get('player-new').evictionControlled).toBe(false);
    expect(stage.get('pm').hammer).toBeNull();
    expect(stage.all().filter(c => c.sprite === 'pm')).toHaveLength(1);
  });
});
