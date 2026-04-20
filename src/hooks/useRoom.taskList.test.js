/**
 * useRoom — grooming backlog coverage.
 *
 * Focused on the `meta/taskList` feature: initial seed, setActiveTask,
 * upsertTasks, and the score-finalization + activeId-advance that
 * `newRound` performs after a reveal. Split out from useRoom.test.js so
 * these can be iterated on independently of the ceremony tests (which
 * dominate runtime thanks to CEREMONY_GRACE_MS).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('../firebase.js', () => import('../test/firebase-mock.js'));

import { useRoom } from './useRoom';
import { __mock } from '../test/firebase-mock.js';

describe('useRoom — grooming backlog', () => {
  beforeEach(() => {
    __mock.reset();
    vi.useRealTimers();
  });

  describe('initial seed', () => {
    it('seeds meta/taskList on first join when initialTasks is non-empty', async () => {
      const { result } = renderHook(() =>
        useRoom('ROOMSEED', 'pm-id', 'PM', 'pm', [
          { title: 'Login', url: 'https://j/1' },
          { title: 'Signup', url: null },
        ]),
      );
      await waitFor(() => expect(result.current.isLeader).toBe(true));
      await waitFor(() => expect(result.current.taskList).toBeTruthy());

      expect(result.current.taskList.activeId).toBe('t1');
      expect(result.current.taskList.items.t1.title).toBe('Login');
      expect(result.current.taskList.items.t1.url).toBe('https://j/1');
      expect(result.current.taskList.items.t1.order).toBe(0);
      expect(result.current.taskList.items.t2.title).toBe('Signup');
      expect(result.current.taskList.items.t2.url).toBe(null);
      // task mirror follows the active item
      expect(result.current.task).toBe('Login');
    });

    it('does NOT seed taskList when initialTasks is empty', async () => {
      const { result } = renderHook(() =>
        useRoom('ROOMNOLIST', 'pm-id', 'PM', 'pm', []),
      );
      await waitFor(() => expect(result.current.isLeader).toBe(true));
      expect(result.current.taskList).toBeNull();
      expect(result.current.task).toBe('');
    });

    it('a later joiner does NOT overwrite an already-seeded taskList', async () => {
      const pm = renderHook(() =>
        useRoom('ROOMJOIN', 'pm-id', 'PM', 'pm', [{ title: 'Seeded', url: null }]),
      );
      await waitFor(() => expect(pm.result.current.taskList).toBeTruthy());

      // A "manager" joining later with their own local list in hand (unusual
      // but possible through URL share) must not reseed.
      const late = renderHook(() =>
        useRoom('ROOMJOIN', 'alice-id', 'Alice', 'pm', [{ title: 'WRONG', url: null }]),
      );
      await waitFor(() => expect(late.result.current.connected).toBe(true));
      await waitFor(() => expect(late.result.current.taskList).toBeTruthy());
      expect(late.result.current.taskList.items.t1.title).toBe('Seeded');
    });
  });

  describe('setActiveTask', () => {
    it('leader switches activeId and mirrors new title into meta/task', async () => {
      const { result } = renderHook(() =>
        useRoom('ROOMACT', 'pm-id', 'PM', 'pm', [
          { title: 'First', url: null },
          { title: 'Second', url: null },
        ]),
      );
      await waitFor(() => expect(result.current.taskList?.activeId).toBe('t1'));

      await act(async () => { await result.current.setActiveTask('t2'); });
      await waitFor(() => expect(result.current.taskList.activeId).toBe('t2'));
      expect(result.current.task).toBe('Second');
    });

    it('unknown id is a no-op', async () => {
      const { result } = renderHook(() =>
        useRoom('ROOMACTX', 'pm-id', 'PM', 'pm', [{ title: 'A', url: null }]),
      );
      await waitFor(() => expect(result.current.taskList?.activeId).toBe('t1'));

      await act(async () => { await result.current.setActiveTask('tZZZ'); });
      expect(result.current.taskList.activeId).toBe('t1');
    });

    it('switching active task wipes every player vote and bounces phase to voting', async () => {
      const { result } = renderHook(() =>
        useRoom('ROOMVOTE', 'pm-id', 'PM', 'pm', [
          { title: 'A', url: null },
          { title: 'B', url: null },
        ]),
      );
      await waitFor(() => expect(result.current.taskList?.activeId).toBe('t1'));

      // Simulate a mid-round state: players have cards on the table,
      // phase is 'revealed', and a shameTimer is live for a holdout.
      const store = __mock.getStore();
      store.rooms.ROOMVOTE.players['p1'] = { name: 'P1', vote: '5', voteFe: '3', voteBe: '8', joinedAt: 0, role: 'player', isLeader: false };
      store.rooms.ROOMVOTE.players['p2'] = { name: 'P2', vote: '8', voteFe: null, voteBe: null, joinedAt: 1, role: 'player', isLeader: false };
      store.rooms.ROOMVOTE.meta.phase = 'revealed';
      store.rooms.ROOMVOTE.meta.shameTimer = { holdoutId: 'p2', holdoutName: 'P2', startedAt: 1 };
      __mock.setStore(store);

      await act(async () => { await result.current.setActiveTask('t2'); });
      await waitFor(() => expect(result.current.taskList.activeId).toBe('t2'));

      const after = __mock.getStore().rooms.ROOMVOTE;
      // Every vote column zeroed for every player — no stale card survives.
      // Firebase-style null writes delete the key, so assertions accept
      // either absent (undefined) or explicit null.
      expect(after.players.p1.vote ?? null).toBeNull();
      expect(after.players.p1.voteFe ?? null).toBeNull();
      expect(after.players.p1.voteBe ?? null).toBeNull();
      expect(after.players.p2.vote ?? null).toBeNull();
      expect(after.players.p2.voteFe ?? null).toBeNull();
      expect(after.players.p2.voteBe ?? null).toBeNull();
      // Phase rewound so the room isn't stuck on the previous task's result.
      expect(after.meta.phase).toBe('voting');
      // Holdout clock cleared — nobody has voted yet on the new task.
      expect(after.meta.shameTimer ?? null).toBeNull();
    });

    it('re-activating the SAME task does not clobber live votes', async () => {
      const { result } = renderHook(() =>
        useRoom('ROOMSAME', 'pm-id', 'PM', 'pm', [{ title: 'Only', url: null }]),
      );
      await waitFor(() => expect(result.current.taskList?.activeId).toBe('t1'));

      const store = __mock.getStore();
      store.rooms.ROOMSAME.players['p1'] = { name: 'P1', vote: '5', joinedAt: 0, role: 'player', isLeader: false };
      __mock.setStore(store);

      await act(async () => { await result.current.setActiveTask('t1'); });

      // Same-id re-activation must be a no-op for votes — otherwise a
      // stray re-render of the TaskListPanel could silently wipe cards.
      const after = __mock.getStore().rooms.ROOMSAME;
      expect(after.players.p1.vote).toBe('5');
    });

    it('non-leader cannot change activeId', async () => {
      const pm = renderHook(() =>
        useRoom('ROOMACTN', 'pm-id', 'PM', 'pm', [
          { title: 'A', url: null },
          { title: 'B', url: null },
        ]),
      );
      await waitFor(() => expect(pm.result.current.isLeader).toBe(true));

      const alice = renderHook(() => useRoom('ROOMACTN', 'alice-id', 'Alice', 'player'));
      await waitFor(() => expect(alice.result.current.connected).toBe(true));
      await waitFor(() => expect(alice.result.current.taskList?.activeId).toBe('t1'));
      expect(alice.result.current.isLeader).toBe(false);

      await act(async () => { await alice.result.current.setActiveTask('t2'); });
      // Still t1 — the call was refused.
      expect(alice.result.current.taskList.activeId).toBe('t1');
    });
  });

  describe('upsertTasks', () => {
    it('preserves scores on existing ids while adding new rows', async () => {
      const { result } = renderHook(() =>
        useRoom('ROOMUP', 'pm-id', 'PM', 'pm', [{ title: 'Keep', url: null }]),
      );
      await waitFor(() => expect(result.current.taskList?.activeId).toBe('t1'));

      // Simulate t1 already groomed: write a score directly into the store.
      const store = __mock.getStore();
      store.rooms.ROOMUP.meta.taskList.items.t1.score = '5';
      store.rooms.ROOMUP.meta.taskList.items.t1.scoredAt = 123;
      __mock.setStore(store);
      await waitFor(() => expect(result.current.taskList.items.t1.score).toBe('5'));

      await act(async () => {
        await result.current.upsertTasks([
          { id: 't1', title: 'Keep', url: null },       // existing
          { title: 'New', url: 'https://new' },         // brand new
        ]);
      });

      await waitFor(() => expect(Object.keys(result.current.taskList.items).length).toBe(2));
      expect(result.current.taskList.items.t1.score).toBe('5');  // preserved
      expect(result.current.taskList.items.t1.scoredAt).toBe(123);
      const newRow = Object.values(result.current.taskList.items).find((it) => it.title === 'New');
      expect(newRow).toBeTruthy();
      expect(newRow.score).toBeNull();
    });

    it('removing the currently-active item advances activeId to the next pending', async () => {
      const { result } = renderHook(() =>
        useRoom('ROOMUP2', 'pm-id', 'PM', 'pm', [
          { title: 'A', url: null },
          { title: 'B', url: null },
          { title: 'C', url: null },
        ]),
      );
      await waitFor(() => expect(result.current.taskList?.activeId).toBe('t1'));

      // Drop t1 (the active one).
      await act(async () => {
        await result.current.upsertTasks([
          { id: 't2', title: 'B', url: null },
          { id: 't3', title: 'C', url: null },
        ]);
      });
      await waitFor(() =>
        expect(Object.keys(result.current.taskList.items).length).toBe(2),
      );
      // activeId should fall to the first remaining pending item.
      expect(result.current.taskList.activeId).toBe('t2');
      expect(result.current.task).toBe('B');
    });

    it('non-leader cannot edit the task list', async () => {
      const pm = renderHook(() =>
        useRoom('ROOMUP3', 'pm-id', 'PM', 'pm', [{ title: 'Orig', url: null }]),
      );
      await waitFor(() => expect(pm.result.current.isLeader).toBe(true));

      const alice = renderHook(() => useRoom('ROOMUP3', 'alice-id', 'Alice', 'player'));
      await waitFor(() => expect(alice.result.current.connected).toBe(true));
      await waitFor(() => expect(alice.result.current.taskList?.activeId).toBe('t1'));

      await act(async () => {
        await alice.result.current.upsertTasks([{ title: 'HIJACK', url: null }]);
      });
      expect(alice.result.current.taskList.items.t1.title).toBe('Orig');
    });

    it('strips non-http urls just like the Landing form does', async () => {
      const { result } = renderHook(() =>
        useRoom('ROOMUP4', 'pm-id', 'PM', 'pm', [{ title: 'A', url: null }]),
      );
      await waitFor(() => expect(result.current.taskList?.activeId).toBe('t1'));

      await act(async () => {
        await result.current.upsertTasks([
          { id: 't1', title: 'A', url: 'javascript:alert(1)' },
          { title: 'B', url: 'https://ok' },
        ]);
      });
      await waitFor(() => expect(Object.keys(result.current.taskList.items).length).toBe(2));
      expect(result.current.taskList.items.t1.url).toBeNull();
      const bRow = Object.values(result.current.taskList.items).find((it) => it.title === 'B');
      expect(bRow.url).toBe('https://ok');
    });
  });

  describe('newRound score finalization', () => {
    it('writes score onto the active item and advances activeId', async () => {
      const pm = renderHook(() =>
        useRoom('ROOMNR', 'pm-id', 'PM', 'pm', [
          { title: 'A', url: null },
          { title: 'B', url: null },
        ]),
      );
      await waitFor(() => expect(pm.result.current.isLeader).toBe(true));

      const alice = renderHook(() => useRoom('ROOMNR', 'alice-id', 'Alice', 'player'));
      await waitFor(() => expect(alice.result.current.connected).toBe(true));
      await waitFor(() => expect(Object.keys(alice.result.current.players).length).toBe(2));

      act(() => alice.result.current.castVote('5'));
      await waitFor(() => expect(alice.result.current.players['alice-id'].vote).toBe('5'));

      await act(async () => { await pm.result.current.revealCards(); });
      await waitFor(() => expect(pm.result.current.phase).toBe('revealed'));

      await act(async () => { await pm.result.current.newRound(); });

      await waitFor(() => {
        expect(pm.result.current.taskList.items.t1.score).toBe('5');
        expect(pm.result.current.taskList.activeId).toBe('t2');
        expect(pm.result.current.task).toBe('B');
      });
      expect(pm.result.current.taskList.items.t1.scoredAt).toBeGreaterThan(0);
    });

    it('sets activeId to null when no pending items remain', async () => {
      const pm = renderHook(() =>
        useRoom('ROOMNR2', 'pm-id', 'PM', 'pm', [{ title: 'Only', url: null }]),
      );
      await waitFor(() => expect(pm.result.current.isLeader).toBe(true));

      const alice = renderHook(() => useRoom('ROOMNR2', 'alice-id', 'Alice', 'player'));
      await waitFor(() => expect(alice.result.current.connected).toBe(true));
      await waitFor(() => expect(Object.keys(alice.result.current.players).length).toBe(2));

      act(() => alice.result.current.castVote('8'));
      await waitFor(() => expect(alice.result.current.players['alice-id'].vote).toBe('8'));
      await act(async () => { await pm.result.current.revealCards(); });
      await waitFor(() => expect(pm.result.current.phase).toBe('revealed'));
      await act(async () => { await pm.result.current.newRound(); });

      await waitFor(() => {
        // Firebase represents a written `null` as an absent key, so the
        // subscription re-emits `activeId` as undefined. Either way, "no
        // active task" is the intent.
        expect(pm.result.current.taskList.activeId ?? null).toBeNull();
        expect(pm.result.current.task).toBe('');
        expect(pm.result.current.taskList.items.t1.score).toBe('8');
      });
    });

    it('split-mode round writes scoreFe and scoreBe, not score', async () => {
      const pm = renderHook(() =>
        useRoom('ROOMNR3', 'pm-id', 'PM', 'pm', [
          { title: 'A', url: null },
          { title: 'B', url: null },
        ]),
      );
      await waitFor(() => expect(pm.result.current.isLeader).toBe(true));
      const alice = renderHook(() => useRoom('ROOMNR3', 'alice-id', 'Alice', 'player'));
      await waitFor(() => expect(Object.keys(alice.result.current.players).length).toBe(2));

      await act(async () => { await pm.result.current.toggleSplit(); });
      await waitFor(() => expect(pm.result.current.splitMode).toBe(true));

      act(() => alice.result.current.castVoteFe('3'));
      act(() => alice.result.current.castVoteBe('13'));
      await waitFor(() => {
        expect(alice.result.current.players['alice-id'].voteFe).toBe('3');
        expect(alice.result.current.players['alice-id'].voteBe).toBe('13');
      });

      await act(async () => { await pm.result.current.revealCards(); });
      await waitFor(() => expect(pm.result.current.phase).toBe('revealed'));
      await act(async () => { await pm.result.current.newRound(); });

      await waitFor(() => {
        expect(pm.result.current.taskList.items.t1.scoreFe).toBe('3');
        expect(pm.result.current.taskList.items.t1.scoreBe).toBe('13');
        expect(pm.result.current.taskList.items.t1.score).toBeNull();
        expect(pm.result.current.taskList.activeId).toBe('t2');
      });
    });

    it('newRound without a taskList leaves legacy behavior intact', async () => {
      const pm = renderHook(() => useRoom('ROOMLEG', 'pm-id', 'PM', 'pm'));
      await waitFor(() => expect(pm.result.current.isLeader).toBe(true));
      const alice = renderHook(() => useRoom('ROOMLEG', 'alice-id', 'Alice', 'player'));
      await waitFor(() => expect(Object.keys(alice.result.current.players).length).toBe(2));

      act(() => alice.result.current.castVote('5'));
      await act(async () => { await pm.result.current.revealCards(); });
      await waitFor(() => expect(pm.result.current.phase).toBe('revealed'));
      await act(async () => { await pm.result.current.newRound(); });

      await waitFor(() => expect(pm.result.current.phase).toBe('voting'));
      expect(pm.result.current.taskList).toBeNull();
      expect(pm.result.current.players['alice-id'].vote).toBeFalsy();
    });
  });
});
