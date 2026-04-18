import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

vi.mock('../firebase.js', () => import('../test/firebase-mock.js'));

import { useRoom, CEREMONY_GRACE_MS } from './useRoom';
import { __mock } from '../test/firebase-mock.js';

describe('firingRef reset on ceremony clear', () => {
  beforeEach(() => {
    __mock.reset();
    vi.useRealTimers();
  });

  // Two back-to-back ceremonies, each gated by CEREMONY_GRACE_MS. Needs a
  // per-test timeout larger than the global default — roughly double the
  // grace window plus Firebase round-trip margin.
  it('allows a new ceremony after the previous one clears (firingRef not stuck)', async () => {
    // Setup: Two players in a room. Alice is leader.
    const alice = renderHook(() => useRoom('ROOM_FR', 'alice-id', 'Alice', 'player'));
    await waitFor(() => expect(alice.result.current.connected).toBe(true));

    const bob = renderHook(() => useRoom('ROOM_FR', 'bob-id', 'Bob', 'player'));
    await waitFor(() => expect(bob.result.current.connected).toBe(true));

    // Alice should be leader (first joiner)
    await waitFor(() => expect(alice.result.current.isLeader).toBe(true));

    // Simulate Alice disconnecting — Bob should become the first candidate
    // and fire a ceremony
    __mock.removePlayer('ROOM_FR', 'alice-id');

    // Wait for ceremony to be written (pmRoulette should appear)
    await waitFor(() => {
      const store = __mock.getStore();
      const meta = store.rooms?.ROOM_FR?.meta;
      return expect(meta?.pmRoulette).toBeTruthy();
    }, { timeout: CEREMONY_GRACE_MS + 3000 });

    // Now simulate the ceremony completing by clearing pmRoulette
    const { set, ref, db } = await import('../test/firebase-mock.js');
    await set(ref(db, 'rooms/ROOM_FR/meta/pmRoulette'), null);

    // Verify pmRoulette is null in the hook state
    await waitFor(() => expect(bob.result.current.pmRoulette).toBeNull());

    // Now add a third player Charlie, make him leader, then remove him.
    // The key test: Bob should be able to fire ANOTHER ceremony because
    // firingRef was reset when pmRoulette went null.
    await set(ref(db, 'rooms/ROOM_FR/players/charlie-id'), {
      name: 'Charlie',
      joinedAt: Date.now(),
      vote: null, voteFe: null, voteBe: null,
      isLeader: true,
      role: 'player',
    });
    // Make Bob not leader so the ceremony trigger can detect the gap
    await set(ref(db, 'rooms/ROOM_FR/players/bob-id/isLeader'), false);

    await waitFor(() => {
      const players = bob.result.current.players;
      return expect(Object.keys(players).length).toBe(2);
    });

    // Remove Charlie — Bob is now the only player, no leader
    __mock.removePlayer('ROOM_FR', 'charlie-id');

    // Bob should fire a new ceremony (firingRef was reset)
    await waitFor(() => {
      const store = __mock.getStore();
      const meta = store.rooms?.ROOM_FR?.meta;
      return expect(meta?.pmRoulette).toBeTruthy();
    }, { timeout: CEREMONY_GRACE_MS + 3000 });
  }, CEREMONY_GRACE_MS * 2 + 10000);
});
