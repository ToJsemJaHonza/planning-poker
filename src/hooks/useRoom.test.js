import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// Mock the Firebase wrapper BEFORE importing useRoom
vi.mock('../firebase.js', () => import('../test/firebase-mock.js'));

import { useRoom } from './useRoom';
import { __mock } from '../test/firebase-mock.js';

describe('useRoom', () => {
  beforeEach(() => {
    __mock.reset();
    vi.useRealTimers();
  });

  describe('Room creation', () => {
    it('creates a new room and makes the creator the leader', async () => {
      const { result } = renderHook(() => useRoom('ROOM1', 'Honza', 'pm'));

      await waitFor(() => expect(result.current.connected).toBe(true));
      await waitFor(() => expect(result.current.isLeader).toBe(true));
      expect(result.current.players.Honza).toBeDefined();
      expect(result.current.players.Honza.isLeader).toBe(true);
      expect(result.current.players.Honza.role).toBe('pm');
    });

    it('seeds the room with meta: voting phase, no split, empty task', async () => {
      const { result } = renderHook(() => useRoom('ROOM2', 'Honza', 'player'));

      await waitFor(() => expect(result.current.connected).toBe(true));
      expect(result.current.phase).toBe('voting');
      expect(result.current.splitMode).toBe(false);
      expect(result.current.task).toBe('');
    });
  });

  describe('Joining an existing room', () => {
    it('a second player joining does NOT overtake leadership if PM is already leader', async () => {
      const pm = renderHook(() => useRoom('ROOM3', 'PM', 'pm'));
      await waitFor(() => expect(pm.result.current.isLeader).toBe(true));

      const player = renderHook(() => useRoom('ROOM3', 'Alice', 'player'));
      await waitFor(() => expect(player.result.current.connected).toBe(true));

      expect(player.result.current.isLeader).toBe(false);
      expect(pm.result.current.isLeader).toBe(true);
    });

    it('players can join and see each other', async () => {
      const pm = renderHook(() => useRoom('ROOM4', 'PM', 'pm'));
      // Wait until PM has fully seeded the room BEFORE joining as Alice —
      // otherwise the two setupPlayer() calls race and both write a fresh room.
      await waitFor(() => expect(pm.result.current.isLeader).toBe(true));

      const p2 = renderHook(() => useRoom('ROOM4', 'Alice', 'player'));

      await waitFor(() => {
        expect(Object.keys(p2.result.current.players).length).toBe(2);
      });
      expect(p2.result.current.players.PM).toBeDefined();
      expect(p2.result.current.players.Alice).toBeDefined();
    });
  });

  describe('Voting mechanics', () => {
    it('castVote writes the vote to the player', async () => {
      const { result } = renderHook(() => useRoom('ROOMV', 'Alice', 'player'));
      await waitFor(() => expect(result.current.connected).toBe(true));

      act(() => result.current.castVote('5'));

      await waitFor(() => expect(result.current.players.Alice.vote).toBe('5'));
    });

    it('castVote is a no-op when phase is "revealed"', async () => {
      const { result } = renderHook(() => useRoom('ROOMV2', 'Alice', 'player'));
      await waitFor(() => expect(result.current.isLeader).toBe(true));

      await act(async () => { await result.current.revealCards(); });
      await waitFor(() => expect(result.current.phase).toBe('revealed'));

      act(() => result.current.castVote('8'));
      // Firebase won't update because castVote bails out
      expect(result.current.players.Alice.vote).toBeFalsy();
    });

    it('castVoteFe and castVoteBe work independently', async () => {
      const { result } = renderHook(() => useRoom('ROOMV3', 'Alice', 'player'));
      await waitFor(() => expect(result.current.connected).toBe(true));

      act(() => result.current.castVoteFe('3'));
      act(() => result.current.castVoteBe('5'));

      await waitFor(() => {
        expect(result.current.players.Alice.voteFe).toBe('3');
        expect(result.current.players.Alice.voteBe).toBe('5');
      });
    });
  });

  describe('Leader controls', () => {
    it('revealCards moves phase to "revealed"', async () => {
      const { result } = renderHook(() => useRoom('ROOMR', 'Alice', 'pm'));
      await waitFor(() => expect(result.current.isLeader).toBe(true));

      await act(async () => { await result.current.revealCards(); });
      await waitFor(() => expect(result.current.phase).toBe('revealed'));
    });

    it('newRound resets phase, votes, and split mode', async () => {
      const pm = renderHook(() => useRoom('ROOMR2', 'PM', 'pm'));
      await waitFor(() => expect(pm.result.current.isLeader).toBe(true));
      const p = renderHook(() => useRoom('ROOMR2', 'Alice', 'player'));
      await waitFor(() => expect(p.result.current.connected).toBe(true));
      // Make sure both hooks see each other before we start voting
      await waitFor(() => expect(Object.keys(p.result.current.players).length).toBe(2));

      act(() => p.result.current.castVote('8'));
      await waitFor(() => expect(p.result.current.players.Alice.vote).toBe('8'));

      await act(async () => { await pm.result.current.toggleSplit(); });
      await waitFor(() => expect(pm.result.current.splitMode).toBe(true));

      await act(async () => { await pm.result.current.revealCards(); });
      await waitFor(() => expect(pm.result.current.phase).toBe('revealed'));

      await act(async () => { await pm.result.current.newRound(); });
      await waitFor(() => {
        expect(pm.result.current.phase).toBe('voting');
        expect(pm.result.current.splitMode).toBe(false);
      });
      expect(pm.result.current.players.Alice.vote).toBeFalsy();
    });

    it('non-leader cannot reveal, toggle split, or new round', async () => {
      const pm = renderHook(() => useRoom('ROOMR3', 'PM', 'pm'));
      await waitFor(() => expect(pm.result.current.isLeader).toBe(true));
      const nonLeader = renderHook(() => useRoom('ROOMR3', 'Alice', 'player'));
      await waitFor(() => expect(nonLeader.result.current.connected).toBe(true));
      await waitFor(() => expect(nonLeader.result.current.isLeader).toBe(false));

      await act(async () => { await nonLeader.result.current.revealCards(); });
      // No change in phase
      expect(nonLeader.result.current.phase).toBe('voting');

      await act(async () => { await nonLeader.result.current.toggleSplit(); });
      expect(nonLeader.result.current.splitMode).toBe(false);
    });

    it('updateTask writes to the room task', async () => {
      const { result } = renderHook(() => useRoom('ROOMT', 'Alice', 'pm'));
      await waitFor(() => expect(result.current.isLeader).toBe(true));

      act(() => result.current.updateTask('Rewrite auth'));
      await waitFor(() => expect(result.current.task).toBe('Rewrite auth'));
    });
  });

  describe('Leader handoff when owner disconnects', () => {
    it('second player is promoted to leader when the old leader is removed', async () => {
      const pm = renderHook(() => useRoom('ROOMH', 'PM', 'pm'));
      await waitFor(() => expect(pm.result.current.isLeader).toBe(true));

      const alice = renderHook(() => useRoom('ROOMH', 'Alice', 'player'));
      await waitFor(() => expect(alice.result.current.connected).toBe(true));
      await waitFor(() => expect(Object.keys(alice.result.current.players).length).toBe(2));
      expect(alice.result.current.isLeader).toBe(false);

      // Simulate PM disconnect (onDisconnect would normally remove their player node)
      act(() => { __mock.removePlayer('ROOMH', 'PM'); });

      // Alice should self-promote
      await waitFor(() => expect(alice.result.current.isLeader).toBe(true), { timeout: 2000 });
    });

    it('takeover also stamps leaderChangedAt AND cleans stuck synced events', async () => {
      const pm = renderHook(() => useRoom('ROOMH2', 'PM', 'pm'));
      await waitFor(() => expect(pm.result.current.isLeader).toBe(true));

      // PM fires a specialRound AND a synced event, then "crashes"
      await act(async () => { await pm.result.current.toggleSplit(); });
      await waitFor(() => expect(pm.result.current.specialRound).toBe(true));

      const alice = renderHook(() => useRoom('ROOMH2', 'Alice', 'player'));
      await waitFor(() => expect(alice.result.current.connected).toBe(true));
      await waitFor(() => expect(Object.keys(alice.result.current.players).length).toBe(2));

      // Remove PM from store (onDisconnect-equivalent)
      act(() => { __mock.removePlayer('ROOMH2', 'PM'); });

      await waitFor(() => expect(alice.result.current.isLeader).toBe(true), { timeout: 2000 });

      // The stuck specialRound should have been cleared by the new leader
      await waitFor(() => expect(alice.result.current.specialRound).toBe(false));
      expect(alice.result.current.leaderChangedAt).toBeGreaterThan(0);
    });

    it('fresh syncedEvent (under 15s) survives a leader takeover', async () => {
      const pm = renderHook(() => useRoom('ROOMFRSH', 'PM', 'pm'));
      await waitFor(() => expect(pm.result.current.isLeader).toBe(true));

      // PM fires a fresh train event
      await act(async () => {
        await pm.result.current.fireSyncedEvent(
          { type: 'train', playerName: 'Richard', fromRight: false },
          12000
        );
      });
      await waitFor(() => expect(pm.result.current.syncedEvent?.type).toBe('train'));

      // Alice joins
      const alice = renderHook(() => useRoom('ROOMFRSH', 'Alice', 'player'));
      await waitFor(() => expect(alice.result.current.connected).toBe(true));
      await waitFor(() => expect(Object.keys(alice.result.current.players).length).toBe(2));

      // PM disconnects → Alice promotes → age guard should preserve train
      act(() => { __mock.removePlayer('ROOMFRSH', 'PM'); });
      await waitFor(() => expect(alice.result.current.isLeader).toBe(true), { timeout: 2000 });

      // Train is still there
      expect(alice.result.current.syncedEvent?.type).toBe('train');
      // But other stuck flags were scrubbed
      expect(alice.result.current.specialRound).toBe(false);
    });

    it('stale syncedEvent (older than 15s) gets wiped on takeover', async () => {
      const pm = renderHook(() => useRoom('ROOMSTALE', 'PM', 'pm'));
      await waitFor(() => expect(pm.result.current.isLeader).toBe(true));

      const alice = renderHook(() => useRoom('ROOMSTALE', 'Alice', 'player'));
      await waitFor(() => expect(alice.result.current.connected).toBe(true));
      await waitFor(() => expect(Object.keys(alice.result.current.players).length).toBe(2));

      // Seed a stale synced event directly into the store: startedAt 20s ago
      const store = __mock.getStore();
      const staleNow = Date.now();
      store.rooms.ROOMSTALE.meta = {
        ...store.rooms.ROOMSTALE.meta,
        syncedEvent: {
          type: 'train',
          playerName: 'Richard',
          fromRight: false,
          startedAt: staleNow - 20000,
          expiresAt: staleNow - 16000,
        },
      };
      __mock.setStore(store);

      // Confirm Alice sees the stale event before takeover
      await waitFor(() => expect(alice.result.current.syncedEvent?.type).toBe('train'));

      // PM disconnects → Alice promotes → stale event must be wiped
      act(() => { __mock.removePlayer('ROOMSTALE', 'PM'); });
      await waitFor(() => expect(alice.result.current.isLeader).toBe(true), { timeout: 2000 });
      await waitFor(() => expect(alice.result.current.syncedEvent).toBeNull());
    });

    it('Strict Mode simulated unmount/remount does NOT wipe the player node', async () => {
      const hook = renderHook(() => useRoom('ROOMSTRICT', 'Alice', 'pm'));
      await waitFor(() => expect(hook.result.current.isLeader).toBe(true));

      // Capture the player record after first mount
      const afterMount1 = __mock.getStore().rooms?.ROOMSTRICT?.players?.Alice;
      expect(afterMount1?.isLeader).toBe(true);

      // Simulate Strict Mode unmount+remount (unmount + re-render the hook)
      hook.unmount();
      const remount = renderHook(() => useRoom('ROOMSTRICT', 'Alice', 'pm'));
      await waitFor(() => expect(remount.result.current.connected).toBe(true));

      const afterMount2 = __mock.getStore().rooms?.ROOMSTRICT?.players?.Alice;
      expect(afterMount2).toBeDefined();
      expect(afterMount2?.isLeader).toBe(true);
    });
  });

  describe('fireSyncedEvent priority', () => {
    it('a minor event does not overwrite an active important event', async () => {
      const { result } = renderHook(() => useRoom('ROOMF', 'Alice', 'pm'));
      await waitFor(() => expect(result.current.isLeader).toBe(true));

      // Fire an important event (train)
      await act(async () => {
        await result.current.fireSyncedEvent({ type: 'train', playerName: 'Richard', fromRight: false }, 5000);
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
      const { result } = renderHook(() => useRoom('ROOMF2', 'Alice', 'pm'));
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
      const { result } = renderHook(() => useRoom('ROOMF3', 'Alice', 'pm'));
      await waitFor(() => expect(result.current.isLeader).toBe(true));

      await act(async () => {
        await result.current.fireSyncedEvent({ type: 'train', playerName: 'Richard', fromRight: false }, 5000);
      });
      await waitFor(() => expect(result.current.syncedEvent?.type).toBe('train'));

      await act(async () => {
        await result.current.fireSyncedEvent({ type: 'dbbPipeline', playerName: 'Tomáš', fromSide: 'top' }, 5000);
      });
      // Train still active, DBB refused
      expect(result.current.syncedEvent?.type).toBe('train');
    });
  });
});
