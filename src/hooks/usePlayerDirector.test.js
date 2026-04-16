import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePlayerDirector } from './usePlayerDirector';
import { createStageRuntime } from './useCharacterStage';
import { ACTION_TYPES } from '../engine/character';
import { computePlayerGridPosition } from '../engine/gridPosition';

function players(...names) {
  const out = {};
  names.forEach((n, i) => {
    out[`p${i}`] = { name: n, role: 'player', joinedAt: 1000 + i };
  });
  return out;
}

beforeEach(() => {
  // computePlayerGridPosition reads window.innerWidth; jsdom default 1024 is fine.
});

describe('usePlayerDirector — join / leave / reshuffle', () => {
  it('creates one character per non-PM player and queues a walk-in to the grid center', () => {
    const stage = createStageRuntime();
    const initial = players('Alice', 'Bob');
    renderHook(({ players: p }) => usePlayerDirector({ stage, players: p }),
      { initialProps: { players: initial } });

    expect(stage.has('player-p0')).toBe(true);
    expect(stage.has('player-p1')).toBe(true);
    expect(stage.size()).toBe(2);

    // Both characters should currently be executing a walkTo toward the grid.
    const vw = window.innerWidth;
    const target0 = computePlayerGridPosition(0, 2, vw);
    const a = stage.get('player-p0');
    // Walk-in action is queued; tick once to pop it into char.action.
    stage.tick(0);
    expect(a.action?.type).toBe(ACTION_TYPES.WALK_TO);
    expect(a.action.x).toBeCloseTo(target0.x, 0);
    expect(a.action.from.x < 0 || a.action.from.x > vw).toBe(true); // offscreen
  });

  it('removes a leaving player via a walkTo-to-offscreen then stage.remove', () => {
    const stage = createStageRuntime();
    const p = players('Alice', 'Bob');
    const { rerender } = renderHook(({ players }) =>
      usePlayerDirector({ stage, players }),
    { initialProps: { players: p } });

    // Sanity: both characters should be on the stage after initial mount.
    expect(stage.has('player-p0')).toBe(true);
    expect(stage.has('player-p1')).toBe(true);

    // Bob leaves
    rerender({ players: { p0: p.p0 } });
    const bob = stage.get('player-p1');
    expect(bob).toBeDefined();
    // Walk-off queued; drain to get the action, then to completion.
    stage.tick(0);
    expect(bob.action?.type).toBe(ACTION_TYPES.WALK_TO);
    const vw0 = window.innerWidth;
    expect(bob.action.x < 0 || bob.action.x > vw0).toBe(true); // target offscreen
    stage.tick(100000);
    expect(stage.has('player-p1')).toBe(false);
  });

  it('does not re-create / churn characters on cosmetic rerenders', () => {
    const stage = createStageRuntime();
    const p = players('Alice', 'Bob');
    const { rerender } = renderHook(({ players, shameStage }) =>
      usePlayerDirector({ stage, players, shameStage }),
    { initialProps: { players: p, shameStage: 0 } });
    const alice = stage.get('player-p0');
    rerender({ players: p, shameStage: 2 });
    rerender({ players: p, shameStage: 3 });
    expect(stage.get('player-p0')).toBe(alice);
  });

  it('reshuffles an existing player when a new player widens the grid', () => {
    const stage = createStageRuntime();
    const p = players('Alice');
    const { rerender } = renderHook(({ players }) =>
      usePlayerDirector({ stage, players }),
    { initialProps: { players: p } });
    const alice = stage.get('player-p0');
    // Finish Alice's join walk so she's sitting on her slot.
    stage.tick(0);
    stage.tick(100000);
    const soloCenter = computePlayerGridPosition(0, 1, window.innerWidth);
    expect(alice.position.x).toBeCloseTo(soloCenter.x, 0);

    rerender({ players: players('Alice', 'Bob') });
    // Alice's slot just shifted left (grid is wider with two players).
    const duoCenter0 = computePlayerGridPosition(0, 2, window.innerWidth);
    expect(duoCenter0.x).not.toBeCloseTo(soloCenter.x, 0);
    // Reshuffle walk queued — pop it onto char.action.
    stage.tick(1);
    expect(alice.action?.type).toBe(ACTION_TYPES.WALK_TO);
    expect(alice.action.x).toBeCloseTo(duoCenter0.x, 0);
  });
});

describe('usePlayerDirector — outgoing leader handoff (Phase 4)', () => {
  it('keeps the outgoing-leader character alive through the ceremony even if they disconnected', () => {
    const stage = createStageRuntime();
    const p = players('Alice', 'Bob');
    // Alice is about to be dethroned. Render, let her settle.
    const { rerender } = renderHook(({ players, pmRoulette }) =>
      usePlayerDirector({ stage, players, pmRoulette }),
    { initialProps: { players: p, pmRoulette: null } });

    // Ceremony starts — Alice becomes the outgoing leader.
    const ceremony = {
      ceremonyId: 'c1',
      startedAt: Date.now() + 60_000, // comfortably in the future so the walk-off timer won't fire yet
      outgoingLeaderId: 'p0',
      outgoingLeaderLastData: { name: 'Alice', role: 'player' },
      outgoingLeaderHadCrown: true,
    };
    // Alice's session drops out of the players map while she's the outgoing leader.
    rerender({ players: { p1: p.p1 }, pmRoulette: ceremony });

    // Her character must still be on the stage, not removed.
    expect(stage.has('player-p0')).toBe(true);
  });

  it('schedules a walk-off when the leader walk-off window opens (ceremony elapsed >= 3000ms)', () => {
    const stage = createStageRuntime();
    const p = players('Alice', 'Bob');
    const { rerender } = renderHook(({ players, pmRoulette }) =>
      usePlayerDirector({ stage, players, pmRoulette }),
    { initialProps: { players: p, pmRoulette: null } });

    // Settle Alice on her slot.
    stage.tick(0);
    stage.tick(100000);

    // Ceremony started 3.5s ago — walkOff is due immediately.
    const ceremony = {
      ceremonyId: 'c1',
      startedAt: Date.now() - 3500,
      outgoingLeaderId: 'p0',
      outgoingLeaderLastData: { name: 'Alice', role: 'player' },
      outgoingLeaderHadCrown: true,
    };
    rerender({ players: { p1: p.p1 }, pmRoulette: ceremony });

    const alice = stage.get('player-p0');
    // Walk-off queued immediately (remainingUntilWalkoff <= 0). Drain the
    // queue into the action and check the target is offscreen.
    stage.tick(0);
    expect(alice.action?.type).toBe(ACTION_TYPES.WALK_TO);
    const vw1 = window.innerWidth;
    expect(alice.action.x < 0 || alice.action.x > vw1).toBe(true); // offscreen target
  });
});

describe('usePlayerDirector — slow-state mirror', () => {
  it('writes shame tremble class on the character during an active shame timer', () => {
    const stage = createStageRuntime();
    const p = players('Alice', 'Bob');
    const { rerender } = renderHook(({ shameTimer, shameStage }) =>
      usePlayerDirector({
        stage, players: p,
        shameTimer, shameStage,
      }),
    { initialProps: { shameTimer: null, shameStage: 0 } });

    rerender({
      shameTimer: { holdoutId: 'p1', holdoutName: 'Bob', startedAt: Date.now() },
      shameStage: 3,
    });
    expect(stage.get('player-p1').className).toContain('shame-tremble-3');
    expect(stage.get('player-p1').stressStage).toBe(3);
    expect(stage.get('player-p0').className).toBe('');
  });

  it('writes player-nod class when everyone has voted', () => {
    const stage = createStageRuntime();
    const p = players('Alice', 'Bob');
    const { rerender } = renderHook(({ allVoted }) =>
      usePlayerDirector({ stage, players: p, allVoted }),
    { initialProps: { allVoted: false } });

    expect(stage.get('player-p0').className).toBe('');
    rerender({ allVoted: true });
    expect(stage.get('player-p0').className).toContain('player-nod');
    expect(stage.get('player-p1').className).toContain('player-nod');
  });

  it('lights up fukEyes when the player is in the ambient fuk-eyes set', () => {
    const stage = createStageRuntime();
    const p = players('Alice', 'Fanda');
    const { rerender } = renderHook(({ fukEyesSet }) =>
      usePlayerDirector({ stage, players: p, fukEyesSet }),
    { initialProps: { fukEyesSet: new Set() } });
    expect(stage.get('player-p1').fukEyes).toBe(false);
    rerender({ fukEyesSet: new Set(['Fanda']) });
    expect(stage.get('player-p1').fukEyes).toBe(true);
  });

  it('shows the crown on the player crownOwnership points at', () => {
    const stage = createStageRuntime();
    const p = players('Alice', 'Bob');
    const { rerender } = renderHook(({ crownOwnership }) =>
      usePlayerDirector({ stage, players: p, crownOwnership }),
    { initialProps: { crownOwnership: null } });

    expect(stage.get('player-p1').crown).toBeNull();
    rerender({ crownOwnership: { location: 'player-head', playerId: 'p1' } });
    expect(stage.get('player-p1').crown).toEqual({ mode: 'settled', glowing: false });
    expect(stage.get('player-p0').crown).toBeNull();
  });
});

describe('usePlayerDirector — no stage is a no-op', () => {
  it('does not throw when stage is null (used by unit-test rigs of usePlayerModels)', () => {
    const p = players('Alice');
    expect(() =>
      renderHook(() => usePlayerDirector({ stage: null, players: p })),
    ).not.toThrow();
  });
});
