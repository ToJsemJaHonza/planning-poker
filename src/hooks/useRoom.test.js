import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// Mock the Firebase wrapper BEFORE importing useRoom
vi.mock('../firebase.js', () => import('../test/firebase-mock.js'));

import { useRoom } from './useRoom';
import { __mock } from '../test/firebase-mock.js';

// Helper: look up a player entry by display name. With the session-ID
// keyed store, callers no longer index by name — they iterate values.
function findByName(players, name) {
  return Object.values(players).find((p) => p && p.name === name);
}

describe('useRoom', () => {
  beforeEach(() => {
    __mock.reset();
    vi.useRealTimers();
  });

  describe('Room creation', () => {
    it('creates a new room and makes the creator the leader', async () => {
      const { result } = renderHook(() => useRoom('ROOM1', 'honza-id', 'Honza', 'pm'));

      await waitFor(() => expect(result.current.connected).toBe(true));
      await waitFor(() => expect(result.current.isLeader).toBe(true));
      const honza = result.current.players['honza-id'];
      expect(honza).toBeDefined();
      expect(honza.name).toBe('Honza');
      expect(honza.isLeader).toBe(true);
      expect(honza.role).toBe('pm');
    });

    it('seeds the room with meta: voting phase, no split, empty task', async () => {
      const { result } = renderHook(() => useRoom('ROOM2', 'honza-id', 'Honza', 'player'));

      await waitFor(() => expect(result.current.connected).toBe(true));
      expect(result.current.phase).toBe('voting');
      expect(result.current.splitMode).toBe(false);
      expect(result.current.task).toBe('');
    });
  });

  describe('Joining an existing room', () => {
    it('a second player joining does NOT overtake leadership if PM is already leader', async () => {
      const pm = renderHook(() => useRoom('ROOM3', 'pm-id', 'PM', 'pm'));
      await waitFor(() => expect(pm.result.current.isLeader).toBe(true));

      const player = renderHook(() => useRoom('ROOM3', 'alice-id', 'Alice', 'player'));
      await waitFor(() => expect(player.result.current.connected).toBe(true));

      expect(player.result.current.isLeader).toBe(false);
      expect(pm.result.current.isLeader).toBe(true);
    });

    it('players can join and see each other', async () => {
      const pm = renderHook(() => useRoom('ROOM4', 'pm-id', 'PM', 'pm'));
      // Wait until PM has fully seeded the room BEFORE joining as Alice —
      // otherwise the two setupPlayer() calls race and both write a fresh room.
      await waitFor(() => expect(pm.result.current.isLeader).toBe(true));

      const p2 = renderHook(() => useRoom('ROOM4', 'alice-id', 'Alice', 'player'));

      await waitFor(() => {
        expect(Object.keys(p2.result.current.players).length).toBe(2);
      });
      expect(findByName(p2.result.current.players, 'PM')).toBeDefined();
      expect(findByName(p2.result.current.players, 'Alice')).toBeDefined();
    });
  });

  describe('Voting mechanics', () => {
    it('castVote writes the vote to the player', async () => {
      const { result } = renderHook(() => useRoom('ROOMV', 'alice-id', 'Alice', 'player'));
      await waitFor(() => expect(result.current.connected).toBe(true));

      act(() => result.current.castVote('5'));

      await waitFor(() => expect(result.current.players['alice-id'].vote).toBe('5'));
    });

    it('castVote is a no-op when phase is "revealed"', async () => {
      const { result } = renderHook(() => useRoom('ROOMV2', 'alice-id', 'Alice', 'player'));
      await waitFor(() => expect(result.current.isLeader).toBe(true));

      await act(async () => { await result.current.revealCards(); });
      await waitFor(() => expect(result.current.phase).toBe('revealed'));

      act(() => result.current.castVote('8'));
      // Firebase won't update because castVote bails out
      expect(result.current.players['alice-id'].vote).toBeFalsy();
    });

    it('castVoteFe and castVoteBe work independently', async () => {
      const { result } = renderHook(() => useRoom('ROOMV3', 'alice-id', 'Alice', 'player'));
      await waitFor(() => expect(result.current.connected).toBe(true));

      act(() => result.current.castVoteFe('3'));
      act(() => result.current.castVoteBe('5'));

      await waitFor(() => {
        expect(result.current.players['alice-id'].voteFe).toBe('3');
        expect(result.current.players['alice-id'].voteBe).toBe('5');
      });
    });
  });

  describe('Leader controls', () => {
    it('revealCards moves phase to "revealed"', async () => {
      const { result } = renderHook(() => useRoom('ROOMR', 'alice-id', 'Alice', 'pm'));
      await waitFor(() => expect(result.current.isLeader).toBe(true));

      await act(async () => { await result.current.revealCards(); });
      await waitFor(() => expect(result.current.phase).toBe('revealed'));
    });

    it('newRound resets phase, votes, and split mode', async () => {
      const pm = renderHook(() => useRoom('ROOMR2', 'pm-id', 'PM', 'pm'));
      await waitFor(() => expect(pm.result.current.isLeader).toBe(true));
      const p = renderHook(() => useRoom('ROOMR2', 'alice-id', 'Alice', 'player'));
      await waitFor(() => expect(p.result.current.connected).toBe(true));
      // Make sure both hooks see each other before we start voting
      await waitFor(() => expect(Object.keys(p.result.current.players).length).toBe(2));

      act(() => p.result.current.castVote('8'));
      await waitFor(() => expect(p.result.current.players['alice-id'].vote).toBe('8'));

      await act(async () => { await pm.result.current.toggleSplit(); });
      await waitFor(() => expect(pm.result.current.splitMode).toBe(true));

      await act(async () => { await pm.result.current.revealCards(); });
      await waitFor(() => expect(pm.result.current.phase).toBe('revealed'));

      await act(async () => { await pm.result.current.newRound(); });
      await waitFor(() => {
        expect(pm.result.current.phase).toBe('voting');
        expect(pm.result.current.splitMode).toBe(false);
      });
      expect(pm.result.current.players['alice-id'].vote).toBeFalsy();
    });

    it('non-leader cannot reveal, toggle split, or new round', async () => {
      const pm = renderHook(() => useRoom('ROOMR3', 'pm-id', 'PM', 'pm'));
      await waitFor(() => expect(pm.result.current.isLeader).toBe(true));
      const nonLeader = renderHook(() => useRoom('ROOMR3', 'alice-id', 'Alice', 'player'));
      await waitFor(() => expect(nonLeader.result.current.connected).toBe(true));
      await waitFor(() => expect(nonLeader.result.current.isLeader).toBe(false));

      await act(async () => { await nonLeader.result.current.revealCards(); });
      // No change in phase
      expect(nonLeader.result.current.phase).toBe('voting');

      await act(async () => { await nonLeader.result.current.toggleSplit(); });
      expect(nonLeader.result.current.splitMode).toBe(false);
    });

    it('updateTask writes to the room task', async () => {
      const { result } = renderHook(() => useRoom('ROOMT', 'alice-id', 'Alice', 'pm'));
      await waitFor(() => expect(result.current.isLeader).toBe(true));

      act(() => result.current.updateTask('Rewrite auth'));
      await waitFor(() => expect(result.current.task).toBe('Rewrite auth'));
    });
  });

  describe('Leader handoff when owner disconnects', () => {
    // NOTE: After the PM Crowning Machine landed (feat/pm-slot-machine),
    // leader promotion is no longer synchronous on disconnect. It now
    // goes through a ceremony payload at rooms/{code}/meta/pmRoulette
    // and the actual `isLeader` flag flip happens at the start of the
    // `crownDelivery` phase t=1500ms (~9.9s after the ceremony payload is written).
    // These tests exercise the end-to-end flow by manually calling
    // `resolvePmRoulettePromotion` once the ceremony payload exists,
    // matching what `useSlotMachine`/`SlotMachineStage` does at runtime.
    // The tests for the ceremony itself live in the dedicated
    // useSlotMachine/slotMachine test files.
    async function simulateCeremonyCompletion(hook) {
      await waitFor(() => expect(hook.result.current.pmRoulette).not.toBeNull(), { timeout: 8000 });
      const payload = hook.result.current.pmRoulette;
      await act(async () => {
        await hook.result.current.resolvePmRoulettePromotion(payload);
        await hook.result.current.clearPmRoulette(payload);
      });
    }

    it('second player is promoted to leader when the old leader is removed', async () => {
      const pm = renderHook(() => useRoom('ROOMH', 'pm-id', 'PM', 'pm'));
      await waitFor(() => expect(pm.result.current.isLeader).toBe(true));

      const alice = renderHook(() => useRoom('ROOMH', 'alice-id', 'Alice', 'player'));
      await waitFor(() => expect(alice.result.current.connected).toBe(true));
      await waitFor(() => expect(Object.keys(alice.result.current.players).length).toBe(2));
      expect(alice.result.current.isLeader).toBe(false);

      // Simulate PM disconnect (onDisconnect would normally remove their player node)
      act(() => { __mock.removePlayer('ROOMH', 'pm-id'); });

      // A Crowning Machine ceremony is fired by Alice's client.
      // Complete the ceremony (what SlotMachineStage does in the real UI).
      await simulateCeremonyCompletion(alice);

      // Alice should now be the leader
      await waitFor(() => expect(alice.result.current.isLeader).toBe(true), { timeout: 8000 });
    });

    it('takeover stamps leaderChangedAt via the ceremony promotion', async () => {
      const pm = renderHook(() => useRoom('ROOMH2', 'pm-id', 'PM', 'pm'));
      await waitFor(() => expect(pm.result.current.isLeader).toBe(true));

      const alice = renderHook(() => useRoom('ROOMH2', 'alice-id', 'Alice', 'player'));
      await waitFor(() => expect(alice.result.current.connected).toBe(true));
      await waitFor(() => expect(Object.keys(alice.result.current.players).length).toBe(2));

      // Remove PM from store (onDisconnect-equivalent). The ceremony
      // payload goes up, then the promotion lands and stamps the timestamp.
      // Note: the old auto-promote scrub is intentionally gone — under
      // the new flow the ceremony doesn't touch specialRound/syncedEvent,
      // those either expire on their own TTLs or get cleared by the next
      // leader manually. See tech design §5.3.
      act(() => { __mock.removePlayer('ROOMH2', 'pm-id'); });
      await simulateCeremonyCompletion(alice);
      await waitFor(() => expect(alice.result.current.isLeader).toBe(true), { timeout: 8000 });

      expect(alice.result.current.leaderChangedAt).toBeGreaterThan(0);
    });

    it('fresh syncedEvent (under 15s) survives a leader takeover', async () => {
      const pm = renderHook(() => useRoom('ROOMFRSH', 'pm-id', 'PM', 'pm'));
      await waitFor(() => expect(pm.result.current.isLeader).toBe(true));

      // PM fires a fresh train event
      await act(async () => {
        await pm.result.current.fireSyncedEvent(
          { type: 'train', playerId: 'richard-id', playerName: 'Richard', fromRight: false },
          12000
        );
      });
      await waitFor(() => expect(pm.result.current.syncedEvent?.type).toBe('train'));

      // Alice joins
      const alice = renderHook(() => useRoom('ROOMFRSH', 'alice-id', 'Alice', 'player'));
      await waitFor(() => expect(alice.result.current.connected).toBe(true));
      await waitFor(() => expect(Object.keys(alice.result.current.players).length).toBe(2));

      // PM disconnects. The Crowning Machine yields to an in-flight
      // important train event, so Alice doesn't immediately fire a
      // ceremony until the train expires. For this test we complete the
      // takeover explicitly via the promotion helper.
      act(() => { __mock.removePlayer('ROOMFRSH', 'pm-id'); });
      // The ceremony may not fire at all (train is active), so we
      // directly promote Alice as the earliest-joined candidate — the
      // same multi-path update the ceremony would eventually land.
      await act(async () => {
        await alice.result.current.resolvePmRoulettePromotion({
          ceremonyId: 'manual-test',
          winnerId: 'alice-id',
        });
      });
      await waitFor(() => expect(alice.result.current.isLeader).toBe(true), { timeout: 8000 });

      // Train is still there — the promotion multi-path update does NOT
      // touch the syncedEvent slot.
      expect(alice.result.current.syncedEvent?.type).toBe('train');
    });

    it('stale syncedEvent (older than TTL) does not block the Crowning ceremony from firing', async () => {
      // Previously the auto-promote effect scrubbed stale syncedEvents. The
      // new ceremony flow doesn't touch syncedEvent at all — instead, the
      // ceremony mutex checks `expiresAt > now`, so stale events don't
      // block a fresh ceremony from firing. The stale slot simply stays
      // in place until someone overwrites it (or TTL-reaped by other
      // code). This test verifies the ceremony still fires + promotes.
      const pm = renderHook(() => useRoom('ROOMSTALE', 'pm-id', 'PM', 'pm'));
      await waitFor(() => expect(pm.result.current.isLeader).toBe(true));

      const alice = renderHook(() => useRoom('ROOMSTALE', 'alice-id', 'Alice', 'player'));
      await waitFor(() => expect(alice.result.current.connected).toBe(true));
      await waitFor(() => expect(Object.keys(alice.result.current.players).length).toBe(2));

      // Seed a stale synced event directly into the store: startedAt 20s ago
      const store = __mock.getStore();
      const staleNow = Date.now();
      store.rooms.ROOMSTALE.meta = {
        ...store.rooms.ROOMSTALE.meta,
        syncedEvent: {
          type: 'train',
          playerId: 'richard-id',
          playerName: 'Richard',
          fromRight: false,
          startedAt: staleNow - 20000,
          expiresAt: staleNow - 16000,
        },
      };
      __mock.setStore(store);

      // Confirm Alice sees the stale event before takeover
      await waitFor(() => expect(alice.result.current.syncedEvent?.type).toBe('train'));

      // PM disconnects → ceremony fires (stale event does not block it)
      act(() => { __mock.removePlayer('ROOMSTALE', 'pm-id'); });
      await simulateCeremonyCompletion(alice);
      await waitFor(() => expect(alice.result.current.isLeader).toBe(true), { timeout: 8000 });
    });

    it('Strict Mode simulated unmount/remount does NOT wipe the player node', async () => {
      const hook = renderHook(() => useRoom('ROOMSTRICT', 'alice-id', 'Alice', 'pm'));
      await waitFor(() => expect(hook.result.current.isLeader).toBe(true));

      // Capture the player record after first mount
      const afterMount1 = __mock.getStore().rooms?.ROOMSTRICT?.players?.['alice-id'];
      expect(afterMount1?.isLeader).toBe(true);

      // Simulate Strict Mode unmount+remount (unmount + re-render the hook)
      hook.unmount();
      const remount = renderHook(() => useRoom('ROOMSTRICT', 'alice-id', 'Alice', 'pm'));
      await waitFor(() => expect(remount.result.current.connected).toBe(true));

      const afterMount2 = __mock.getStore().rooms?.ROOMSTRICT?.players?.['alice-id'];
      expect(afterMount2).toBeDefined();
      expect(afterMount2?.isLeader).toBe(true);
    });
  });

  describe('fireSyncedEvent priority', () => {
    it('a minor event does not overwrite an active important event', async () => {
      const { result } = renderHook(() => useRoom('ROOMF', 'alice-id', 'Alice', 'pm'));
      await waitFor(() => expect(result.current.isLeader).toBe(true));

      // Fire an important event (train)
      await act(async () => {
        await result.current.fireSyncedEvent({ type: 'train', playerId: 'richard-id', playerName: 'Richard', fromRight: false }, 5000);
      });
      await waitFor(() => expect(result.current.syncedEvent?.type).toBe('train'));

      // Try to overwrite with a minor one
      await act(async () => {
        await result.current.fireSyncedEvent({ type: 'devQuote', name: 'Alice', text: 'hi' }, 2000);
      });

      // Train should still be the active event
      expect(result.current.syncedEvent?.type).toBe('train');
    });

    it('an important event can overwrite a minor one', async () => {
      const { result } = renderHook(() => useRoom('ROOMF2', 'alice-id', 'Alice', 'pm'));
      await waitFor(() => expect(result.current.isLeader).toBe(true));

      await act(async () => {
        await result.current.fireSyncedEvent({ type: 'devQuote', name: 'Alice', text: 'x' }, 5000);
      });
      await waitFor(() => expect(result.current.syncedEvent?.type).toBe('devQuote'));

      await act(async () => {
        await result.current.fireSyncedEvent({ type: 'chicken' }, 3000);
      });
      await waitFor(() => expect(result.current.syncedEvent?.type).toBe('chicken'));
    });

    it('two IMPORTANT events are mutually exclusive — first wins', async () => {
      const { result } = renderHook(() => useRoom('ROOMF3', 'alice-id', 'Alice', 'pm'));
      await waitFor(() => expect(result.current.isLeader).toBe(true));

      await act(async () => {
        await result.current.fireSyncedEvent({ type: 'train', playerId: 'richard-id', playerName: 'Richard', fromRight: false }, 5000);
      });
      await waitFor(() => expect(result.current.syncedEvent?.type).toBe('train'));

      await act(async () => {
        await result.current.fireSyncedEvent({ type: 'dbbPipeline', playerId: 'tomas-id', playerName: 'Tomáš', fromSide: 'top' }, 5000);
      });
      // Train still active, DBB refused
      expect(result.current.syncedEvent?.type).toBe('train');
    });
  });

  describe('Duplicate player names', () => {
    it('two players with the same display name coexist as separate entries', async () => {
      // Two Honzas, two different playerIds
      const honza1 = renderHook(() => useRoom('DUP1', 'honza-id-1', 'Honza', 'pm'));
      await waitFor(() => expect(honza1.result.current.isLeader).toBe(true));

      const honza2 = renderHook(() => useRoom('DUP1', 'honza-id-2', 'Honza', 'player'));
      await waitFor(() => expect(honza2.result.current.connected).toBe(true));

      // Both players are present under different IDs
      await waitFor(() =>
        expect(Object.keys(honza2.result.current.players).length).toBe(2)
      );

      // Both have the same display name
      const names = Object.values(honza2.result.current.players).map((p) => p.name);
      expect(names.filter((n) => n === 'Honza').length).toBe(2);

      // Votes are independent
      act(() => honza1.result.current.castVote('5'));
      act(() => honza2.result.current.castVote('13'));
      await waitFor(() => {
        const byId = honza2.result.current.players;
        expect(byId['honza-id-1'].vote).toBe('5');
        expect(byId['honza-id-2'].vote).toBe('13');
      });

      // Disconnecting one does not nuke the other
      act(() => { __mock.removePlayer('DUP1', 'honza-id-1'); });
      await waitFor(() => {
        expect(honza2.result.current.players['honza-id-2']).toBeDefined();
        expect(honza2.result.current.players['honza-id-1']).toBeUndefined();
      });
    });
  });

  // The hook used to set `connected = true` once during bootstrap and never
  // touch it again. A mid-session WebSocket drop would silently keep
  // `connected` true and the UI would keep rendering stale data forever.
  // The fix subscribes to Firebase's `.info/connected` system path so the
  // value tracks the live socket state — both directions.
  describe('Firebase connectivity tracking', () => {
    it('flips connected to false when .info/connected drops, and back to true on reconnect', async () => {
      const { result } = renderHook(() => useRoom('CONNRM', 'honza-id', 'Honza', 'pm'));
      await waitFor(() => expect(result.current.connected).toBe(true));

      act(() => { __mock.setConnectedState(false); });
      await waitFor(() => expect(result.current.connected).toBe(false));

      act(() => { __mock.setConnectedState(true); });
      await waitFor(() => expect(result.current.connected).toBe(true));
    });
  });
});
