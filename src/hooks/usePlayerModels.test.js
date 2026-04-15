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

  it('attaches showCrown only to the player crownOwnership points at', () => {
    const players = makePlayers('Alice', 'Bob');
    const { result } = renderHook(() => usePlayerModels({
      players,
      currentPlayer: 'p0',
      phase: 'voting',
      splitMode: false,
      syncedEvent: null,
      fireSyncedEvent: () => {},
      isLeader: true,
      crownOwnership: { location: 'player-head', playerId: 'p1' },
    }));
    const alice = result.current.activePlayers.find(m => m.id === 'p0');
    const bob = result.current.activePlayers.find(m => m.id === 'p1');
    expect(alice.showCrown).toBe(false);
    expect(bob.showCrown).toBe(true);
  });

  it('emits a synthetic outgoing-leader model while the crown ceremony is active', () => {
    const players = makePlayers('Alice', 'Bob'); // outgoing already removed from players
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
    expect(result.current.outgoingLeader).not.toBeNull();
    expect(result.current.outgoingLeader.id).toBe(outgoingId);
    expect(result.current.outgoingLeader.isSyntheticLeader).toBe(true);
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

  it('suppresses doNod for a player still in their walk-in animation', () => {
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
    }));
    // Players just appeared — they should be walking in, not nodding.
    for (const m of result.current.activePlayers) {
      expect(m.doNod).toBe(false);
    }
  });
});
