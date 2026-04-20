/**
 * Regression test for the "refresh triggers crown-handover ceremony" bug.
 *
 * Repro before the fix:
 *   1. Leader (alone with one other player) presses F5 / reloads the tab.
 *   2. `onDisconnect` marks them `disconnected: true` in Firebase.
 *   3. With the old 5 s grace window, the surviving client fired a ceremony
 *      before the refresh round-trip (auth + ws reconnect + setupPlayer)
 *      completed and cleared `disconnected` back to false.
 *   4. User saw themselves duplicated (slot machine reel + grid slot) and
 *      an unwanted crown-handover ceremony ran.
 *
 * Fix:
 *   - CEREMONY_GRACE_MS set to 10 s (comfortably exceeds a cold refresh;
 *     was briefly 15 s, then shortened so genuine departures feel snappier).
 *   - Grace-timer callback re-reads live Firebase state at fire time and
 *     aborts if a connected leader is present.
 *
 * This test simulates the refresh by marking the leader disconnected, then
 * — before the grace expires — marking them connected again. The surviving
 * client must NOT write a pmRoulette payload.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

vi.mock('../firebase.js', () => import('../test/firebase-mock.js'));

import { useRoom, CEREMONY_GRACE_MS } from './useRoom';
import { __mock, set, ref, db } from '../test/firebase-mock.js';

describe('useRoom — refresh during grace window', () => {
  beforeEach(() => {
    __mock.reset();
    vi.useRealTimers();
  });

  it('leader refresh (disconnect → reconnect within grace) does not trigger ceremony', async () => {
    // Two players: Alice (leader) and Bob (survivor).
    const alice = renderHook(() => useRoom('ROOM_RG', 'alice-id', 'Alice', 'player'));
    await waitFor(() => expect(alice.result.current.connected).toBe(true));
    const bob = renderHook(() => useRoom('ROOM_RG', 'bob-id', 'Bob', 'player'));
    await waitFor(() => expect(bob.result.current.connected).toBe(true));
    await waitFor(() => expect(alice.result.current.isLeader).toBe(true));
    await waitFor(() => expect(Object.keys(bob.result.current.players).length).toBe(2));

    // Simulate the onDisconnect payload fired by a page refresh: leader
    // record stays in the DB but gets disconnected=true. Also unmount the
    // leader hook — in a real refresh the tab is gone, so its copy of
    // useRoom is no longer running.
    alice.unmount();
    await set(ref(db, 'rooms/ROOM_RG/players/alice-id/disconnected'), true);

    // Bob sees the disconnected flag.
    await waitFor(() => expect(
      bob.result.current.players['alice-id']?.disconnected
    ).toBe(true));

    // Simulate a realistic cold refresh round-trip — longer than the
    // OLD 5 s grace but still well under the current 10 s grace. This is
    // the exact window where the old code fired a spurious ceremony: the
    // refresh hadn't completed by t = 5 s, so Bob's grace timer expired
    // against a still-disconnected leader. With the new 10 s grace, the
    // reconnect lands first, React re-runs the trigger effect with a
    // reconnected leader, and the pending grace timer is cleared.
    await new Promise((resolve) => setTimeout(resolve, 6000));
    await set(ref(db, 'rooms/ROOM_RG/players/alice-id/disconnected'), false);

    // Wait past the current grace window to be sure no ceremony fires.
    await new Promise((resolve) => setTimeout(resolve, 6000));

    // No ceremony was written.
    const store = __mock.getStore();
    expect(store.rooms?.ROOM_RG?.meta?.pmRoulette ?? null).toBeNull();
    expect(bob.result.current.pmRoulette).toBeNull();

    // Alice is still the leader (nobody was promoted).
    expect(bob.result.current.players['alice-id']?.isLeader).toBe(true);
    expect(bob.result.current.isLeader).toBe(false);
  }, CEREMONY_GRACE_MS * 2 + 10000);
});
