import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePlayerModels } from './usePlayerModels';
import { __testing__ as motionTesting } from '../engine/MotionRuntime';

// Stub out the side-effecting hooks so this test file can focus on the
// model derivation logic. The real entrance/ambient hooks have their own
// dedicated tests.
vi.mock('../events/useEntranceEvents', () => ({
  useEntranceEvents: () => ({
    activeEntrance: null,
    hiddenPlayers: new Set(),
    markArrived: () => {},
    recentArrivals: new Set(),
  }),
}));
vi.mock('./useAmbientEvents', () => ({
  useAmbientEvents: () => ({
    fukEyesSet: new Set(),
    activeQuote: null,
  }),
}));

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

function makePlayers(...names) {
  const out = {};
  names.forEach((n, i) => {
    out[`p${i}`] = { name: n, role: 'player', joinedAt: 1000 + i, isLeader: i === 0 };
  });
  return out;
}

describe('usePlayerModels', () => {
  beforeEach(() => {
    installRaf();
    motionTesting.reset();
  });

  afterEach(() => {
    motionTesting.reset();
    vi.restoreAllMocks();
  });

  it('builds a model per player in joinedAt order, marking the current player isMe', () => {
    const players = makePlayers('Alice', 'Bob', 'Cara');
    const { result } = renderHook(() => usePlayerModels({
      players,
      currentPlayer: 'p1',
      phase: 'voting',
      splitMode: false,
      syncedEvent: null,
      fireSyncedEvent: () => {},
      isLeader: false,
    }));
    const ids = result.current.activePlayers.map(m => m.id);
    expect(ids).toEqual(['p0', 'p1', 'p2']);
    const me = result.current.activePlayers.find(m => m.id === 'p1');
    expect(me.isMe).toBe(true);
    expect(result.current.activePlayers[0].isMe).toBe(false);
  });

  it('flags shame holdout with stress stage and propagates the timer start', () => {
    const players = makePlayers('Alice', 'Bob');
    const timerStartedAt = 1_700_000_000_000;
    const { result } = renderHook(() => usePlayerModels({
      players,
      currentPlayer: 'p0',
      phase: 'voting',
      splitMode: false,
      syncedEvent: null,
      fireSyncedEvent: () => {},
      isLeader: true,
      shameTimer: { holdoutId: 'p1', holdoutName: 'Bob', startedAt: timerStartedAt },
      shameStage: 3,
    }));
    const alice = result.current.activePlayers.find(m => m.id === 'p0');
    const bob = result.current.activePlayers.find(m => m.id === 'p1');
    expect(alice.stressStage).toBe(0);
    expect(alice.shameStartedAt).toBe(0);
    expect(bob.stressStage).toBe(3);
    expect(bob.shameStartedAt).toBe(timerStartedAt);
    expect(bob.className).toContain('shame-tremble-3');
  });

  it('injects the outgoing leader into activePlayers during the ceremony so the name tag stays anchored to the on-stage figure', () => {
    // Outgoing leader's record was already removed from the players map.
    // Previously the hook rendered a separate "synthetic" card without
    // voting cards above it; that shorter layout pulled the name tag up
    // into the figure's sprite. Now the outgoing leader is a normal
    // activePlayer entry, rendered with the full card chrome, so the
    // name tag sits at the same y as every other grid slot.
    const players = makePlayers('Alice', 'Bob');
    const outgoingId = 'p99';
    const { result } = renderHook(() => usePlayerModels({
      players,
      currentPlayer: 'p0',
      phase: 'voting',
      splitMode: false,
      syncedEvent: null,
      fireSyncedEvent: () => {},
      isLeader: true,
      pmRoulette: {
        outgoingLeaderId: outgoingId,
        outgoingLeaderLastData: { name: 'Old Boss', role: 'player', isLeader: true },
        startedAt: Date.now(),
        ceremonyId: 'c1',
      },
    }));
    expect(result.current.outgoingLeader).toBeNull();
    const ids = result.current.activePlayers.map(m => m.id);
    expect(ids).toContain(outgoingId);
    const outgoing = result.current.activePlayers.find(m => m.id === outgoingId);
    // The outgoing card must render the full chrome (voting card slot
    // above the figure) — otherwise its flex column is shorter and the
    // name tag pulls up into the figure. We assert on the two flags
    // PlayerCard checks when deciding what to render.
    expect(outgoing.isSyntheticLeader).toBe(false);
    expect(outgoing.isPlaceholder).toBe(false);
    expect(outgoing.displayName).toBe('Old Boss');
  });

  it('keeps the grid and stage indices aligned when the leader disconnects mid-ceremony (no name-tag shift)', () => {
    // REGRESSION: prior to the shared-roster fix, usePlayerModels filtered
    // disconnected players out of the grid while usePlayerDirector kept
    // the disconnected leader on stage. With Alice (index 0) disconnected
    // but isLeader=true, the grid rendered Bob and Cara at indices 0/1
    // while the stage painted Alice/Bob/Cara at 0/1/2 — so "Bob" name tag
    // ended up under Alice's figure.
    const players = {
      p0: { name: 'Alice', role: 'player', joinedAt: 1000, isLeader: true, disconnected: true },
      p1: { name: 'Bob', role: 'player', joinedAt: 2000 },
      p2: { name: 'Cara', role: 'player', joinedAt: 3000 },
    };
    const { result } = renderHook(() => usePlayerModels({
      players,
      currentPlayer: 'p1',
      phase: 'voting',
      splitMode: false,
      syncedEvent: null,
      fireSyncedEvent: () => {},
      isLeader: false,
    }));
    const ids = result.current.activePlayers.map(m => m.id);
    expect(ids).toEqual(['p0', 'p1', 'p2']); // Alice kept — figure and name tag stay together
    const alice = result.current.activePlayers.find(m => m.id === 'p0');
    expect(alice.displayName).toBe('Alice');
  });

  it('marks every active player with doNod when allVoted and the entrance window has passed', () => {
    vi.useFakeTimers();
    const players = makePlayers('Alice', 'Bob');
    const { result, rerender } = renderHook(
      ({ allVoted }) => usePlayerModels({
        players,
        currentPlayer: 'p0',
        phase: 'voting',
        splitMode: false,
        syncedEvent: null,
        fireSyncedEvent: () => {},
        isLeader: true,
        allVoted,
      }),
      { initialProps: { allVoted: false } },
    );
    // Drain the walk-in window so neither player counts as entering anymore.
    vi.advanceTimersByTime(6000);
    rerender({ allVoted: true });
    for (const m of result.current.activePlayers) {
      expect(m.doNod).toBe(true);
      expect(m.className).toContain('player-nod');
    }
    vi.useRealTimers();
  });

  it('still fires doNod on the injected outgoing leader, but the stage director suppresses the nod CSS class during the ceremony', () => {
    // The model-side `doNod` is just the "allVoted" gate — it fires even
    // for the outgoing leader. What MUST NOT happen is the nod CSS class
    // landing on the figure while the crowning ceremony is playing; that
    // suppression is owned by `usePlayerDirector`, which has its own
    // dedicated regression coverage. Here we only prove the model hasn't
    // quietly regressed to emitting a special doNod override.
    const players = makePlayers('Alice', 'Bob');
    const { result } = renderHook(() => usePlayerModels({
      players,
      currentPlayer: 'p0',
      phase: 'voting',
      splitMode: false,
      syncedEvent: null,
      fireSyncedEvent: () => {},
      isLeader: true,
      allVoted: true,
      pmRoulette: {
        outgoingLeaderId: 'p99',
        outgoingLeaderLastData: { name: 'Old Boss', role: 'player', isLeader: true },
        startedAt: Date.now(),
        ceremonyId: 'c1',
      },
    }));
    expect(result.current.outgoingLeader).toBeNull();
    const outgoing = result.current.activePlayers.find(m => m.id === 'p99');
    expect(outgoing).toBeDefined();
    expect(outgoing.doNod).toBe(true);
  });
});
