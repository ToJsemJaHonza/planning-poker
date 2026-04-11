import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

import { useEntranceEvents } from './useEntranceEvents';
import { ENTRANCE_EVENTS, findEntranceByType, findEntranceForName } from './entranceEvents';

// The engine is Firebase-agnostic — we pass in a stub fireSyncedEvent and
// mutate syncedEvent via re-renders. No firebase-mock needed here.

function makeEntries(names) {
  return names.map((n, i) => [n, { joinedAt: i + 1 }]);
}

describe('Entrance event registry', () => {
  it('exposes Richard train and Tomáš DBB', () => {
    expect(findEntranceByType('train')).toBeTruthy();
    expect(findEntranceByType('dbbPipeline')).toBeTruthy();
  });

  it('matches Richard variants to the train event', () => {
    expect(findEntranceForName('Richard')?.type).toBe('train');
    expect(findEntranceForName('Ricardo')?.type).toBe('train');
    expect(findEntranceForName('R.I.C.H.A.R.D')?.type).toBe('train');
  });

  it('matches Tomáš variants to the DBB event', () => {
    expect(findEntranceForName('Tomáš')?.type).toBe('dbbPipeline');
    expect(findEntranceForName('Tomas')?.type).toBe('dbbPipeline');
    expect(findEntranceForName('Tom')?.type).toBe('dbbPipeline');
  });

  it('returns null for unrelated names', () => {
    expect(findEntranceForName('Alice')).toBeNull();
    expect(findEntranceForName('Honza')).toBeNull();
  });

  it('each registry entry exposes the required shape', () => {
    for (const e of ENTRANCE_EVENTS) {
      expect(typeof e.type).toBe('string');
      expect(typeof e.match).toBe('function');
      expect(typeof e.buildPayload).toBe('function');
      expect(typeof e.duration).toBe('number');
      expect(typeof e.Component).toBe('function'); // React component
      expect(typeof e.getHiddenPlayer).toBe('function');
    }
  });
});

describe('useEntranceEvents — derivations', () => {
  it('activeEntrance is null when syncedEvent is null', () => {
    const { result } = renderHook(() =>
      useEntranceEvents({
        playerEntries: makeEntries([]),
        isLeader: false,
        syncedEvent: null,
        fireSyncedEvent: vi.fn(),
      })
    );
    expect(result.current.activeEntrance).toBeNull();
    expect(result.current.hiddenPlayers.size).toBe(0);
  });

  it('activeEntrance resolves to the train registry entry', () => {
    const { result } = renderHook(() =>
      useEntranceEvents({
        playerEntries: makeEntries(['Richard']),
        isLeader: false,
        syncedEvent: { type: 'train', playerName: 'Richard', fromRight: false },
        fireSyncedEvent: vi.fn(),
      })
    );
    expect(result.current.activeEntrance?.event.type).toBe('train');
    expect(result.current.hiddenPlayers.has('Richard')).toBe(true);
  });

  it('activeEntrance resolves to the DBB registry entry', () => {
    const { result } = renderHook(() =>
      useEntranceEvents({
        playerEntries: makeEntries(['Tomáš']),
        isLeader: false,
        syncedEvent: { type: 'dbbPipeline', playerName: 'Tomáš', fromSide: 'top' },
        fireSyncedEvent: vi.fn(),
      })
    );
    expect(result.current.activeEntrance?.event.type).toBe('dbbPipeline');
    expect(result.current.hiddenPlayers.has('Tomáš')).toBe(true);
  });

  it('hiddenPlayers is empty for unrelated syncedEvents', () => {
    const { result } = renderHook(() =>
      useEntranceEvents({
        playerEntries: makeEntries(['Honza']),
        isLeader: false,
        syncedEvent: { type: 'devQuote', name: 'Honza', text: 'hi' },
        fireSyncedEvent: vi.fn(),
      })
    );
    expect(result.current.activeEntrance).toBeNull();
    expect(result.current.hiddenPlayers.size).toBe(0);
  });
});

describe('useEntranceEvents — trigger side effects', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('only the leader fires events', () => {
    const fireSyncedEvent = vi.fn(() => true);
    renderHook(() =>
      useEntranceEvents({
        playerEntries: makeEntries(['Richard']),
        isLeader: false,
        syncedEvent: null,
        fireSyncedEvent,
      })
    );
    expect(fireSyncedEvent).not.toHaveBeenCalled();
  });

  it('leader fires train when Richard joins (forced 100%)', () => {
    // Stub Math.random so the 10% roll becomes deterministic
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const fireSyncedEvent = vi.fn(() => true);
    renderHook(() =>
      useEntranceEvents({
        playerEntries: makeEntries(['Richard']),
        isLeader: true,
        syncedEvent: null,
        fireSyncedEvent,
      })
    );
    expect(fireSyncedEvent).toHaveBeenCalledTimes(1);
    expect(fireSyncedEvent.mock.calls[0][0].type).toBe('train');
    expect(fireSyncedEvent.mock.calls[0][0].playerName).toBe('Richard');
  });

  it('does NOT fire a second cinematic when one is already active', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const fireSyncedEvent = vi.fn(() => true);
    renderHook(() =>
      useEntranceEvents({
        playerEntries: makeEntries(['Richard', 'Tomáš']),
        isLeader: true,
        // train already playing — Tomas must NOT fire
        syncedEvent: { type: 'train', playerName: 'Richard', fromRight: false },
        fireSyncedEvent,
      })
    );
    expect(fireSyncedEvent).not.toHaveBeenCalled();
  });

  it('fires at most ONE event per tick even if two matching players join together', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const fireSyncedEvent = vi.fn(() => true);
    renderHook(() =>
      useEntranceEvents({
        playerEntries: makeEntries(['Richard', 'Tomáš']),
        isLeader: true,
        syncedEvent: null,
        fireSyncedEvent,
      })
    );
    expect(fireSyncedEvent).toHaveBeenCalledTimes(1);
  });

  it('each name only gets one chance — second render with the same player does NOT re-fire', () => {
    // First render rolls and fails (Math.random = 0.99 > 0.1)
    const r = vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const fireSyncedEvent = vi.fn(() => true);
    const { rerender } = renderHook(
      ({ syncedEvent }) =>
        useEntranceEvents({
          playerEntries: makeEntries(['Richard']),
          isLeader: true,
          syncedEvent,
          fireSyncedEvent,
        }),
      { initialProps: { syncedEvent: null } }
    );
    // Now switch Math.random so it WOULD roll — but the name has already
    // been marked as tried, so no fire should happen.
    r.mockReturnValue(0);
    rerender({ syncedEvent: null });
    expect(fireSyncedEvent).not.toHaveBeenCalled();
  });
});
