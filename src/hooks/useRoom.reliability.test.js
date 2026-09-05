import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useRoom } from './useRoom';
import { __mock, db, ref, update } from '../test/firebase-mock';
import { buildTaskText } from '../components/room/export.utils';
import * as firebase from '../firebase';

vi.mock('../firebase', () => import('../test/firebase-mock'));

beforeEach(() => __mock.reset());
afterEach(() => vi.restoreAllMocks());

async function room(role = 'pm') {
  const hook = renderHook(() => useRoom('REVIEW', 'me', 'Alex', role, [
    { title: 'First' }, { title: 'Second' },
  ]));
  await waitFor(() => expect(hook.result.current.isLeader).toBe(true));
  await waitFor(() => expect(hook.result.current.connected).toBe(true));
  return hook;
}

describe('room reliability', () => {
  it('completes a first join interrupted after arming onDisconnect', async () => {
    __mock.setStore({ '.info': { connected: true }, rooms: { REVIEW: {
      players: { me: { disconnected: true } },
    } } });
    const { result } = await room('player');
    expect(result.current.players.me).toMatchObject({ name: 'Alex', role: 'player', isLeader: true, disconnected: false });
  });

  it('reports setup failure instead of claiming to be connected', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(firebase, 'get').mockRejectedValueOnce(new Error('Permission denied'));
    const { result } = renderHook(() => useRoom('REVIEW', 'me', 'Alex'));
    await waitFor(() => expect(result.current.connectionError).toMatch(/Could not connect/));
    expect(result.current.connected).toBe(false);
    expect(result.current.players).toEqual({});
  });

  it('does not publish a player before the disconnect handler is acknowledged', async () => {
    let acknowledge;
    vi.spyOn(firebase, 'onDisconnect').mockReturnValueOnce({
      update: () => new Promise(resolve => { acknowledge = resolve; }),
    });
    const { result } = renderHook(() => useRoom('REVIEW', 'me', 'Alex'));
    await act(async () => {});
    expect(result.current.connected).toBe(false);
    expect(result.current.players).toEqual({});
    await act(async () => acknowledge());
    await waitFor(() => expect(result.current.connected).toBe(true));
    expect(result.current.players.me.name).toBe('Alex');
  });

  it('does not complete pending setup after the room unmounts', async () => {
    let acknowledge;
    vi.spyOn(firebase, 'onDisconnect').mockReturnValueOnce({
      update: () => new Promise(resolve => { acknowledge = resolve; }),
    });
    const { unmount } = renderHook(() => useRoom('REVIEW', 'me', 'Alex'));
    unmount();
    await act(async () => acknowledge());
    expect(__mock.getStore().rooms?.REVIEW).toBeUndefined();
  });

  it('does not recreate an ended room on reconnect', async () => {
    const { result } = await room();
    act(() => __mock.setConnectedState(false));
    await act(async () => { await firebase.remove(ref(db, 'rooms/REVIEW')); });
    act(() => __mock.setConnectedState(true));
    await act(async () => {});
    expect(result.current.roomDeleted).toBe(true);
    expect(__mock.getStore().rooms?.REVIEW).toBeUndefined();
  });

  it.each(['pm', 'player'])('restores %s presence and rearms disconnect across repeated network drops', async role => {
    const { result } = await room(role);
    await act(async () => {
      await update(ref(db, 'rooms/REVIEW/players/me'), { vote: '13', voteFe: '5', voteBe: '8' });
    });
    const original = result.current.players.me;
    for (let attempt = 0; attempt < 2; attempt++) {
      act(() => {
        __mock.setConnectedState(false);
        __mock.triggerDisconnect('rooms/REVIEW/players/me');
      });
      expect(result.current.connected).toBe(false);
      expect(result.current.players.me.disconnected).toBe(true);
      act(() => __mock.setConnectedState(true));
      await waitFor(() => expect(result.current.connected).toBe(true));
      expect(result.current.players.me).toEqual(original);
    }
  });

  it.each(['voting', 'revealed'])('removing the active task during %s resets all votes for the replacement task', async phase => {
    const { result } = await room();
    await act(async () => {
      await update(ref(db, 'rooms/REVIEW'), {
        'meta/phase': phase,
        'meta/shameTimer': { holdoutId: 'me', startedAt: Date.now() },
        'players/me/vote': '21', 'players/me/voteFe': '13', 'players/me/voteBe': '8',
      });
      await result.current.upsertTasks([{ id: 't2', title: 'Second' }]);
    });
    expect(result.current.taskList.activeId).toBe('t2');
    expect(result.current.phase).toBe('voting');
    expect(result.current.shameTimer).toBeNull();
    for (const key of ['vote', 'voteFe', 'voteBe']) expect(result.current.players.me[key] ?? null).toBeNull();
  });

  it('selecting a task after free voting clears unrelated votes even with no prior active task', async () => {
    const { result } = await room();
    await act(async () => {
      await update(ref(db, 'rooms/REVIEW'), {
        'meta/taskList/activeId': null, 'meta/phase': 'revealed', 'players/me/vote': '21',
      });
      await result.current.setActiveTask('t1');
    });
    expect(result.current.phase).toBe('voting');
    expect(result.current.players.me.vote ?? null).toBeNull();
  });

  it.each([false, true])('rescoring a task with split=%s replaces the previous scoring mode in exports', async splitMode => {
    const { result } = await room('player');
    await act(async () => {
      await update(ref(db, 'rooms/REVIEW'), {
        'meta/phase': 'revealed', 'meta/splitMode': splitMode,
        'meta/taskList/items/t1/score': '21',
        'meta/taskList/items/t1/scoreFe': '13', 'meta/taskList/items/t1/scoreBe': '21',
        'players/me/vote': '5', 'players/me/voteFe': '3', 'players/me/voteBe': '8',
      });
      await result.current.newRound();
    });
    const item = result.current.taskList.items.t1;
    if (splitMode) {
      expect(item.score ?? null).toBeNull();
      expect(buildTaskText([item])).toBe('First-FE — 3\nFirst-BE — 8\n');
    } else {
      expect(item.scoreFe ?? null).toBeNull();
      expect(item.scoreBe ?? null).toBeNull();
      expect(buildTaskText([item])).toBe('First — 5\n');
    }
  });

  it('editing another task preserves current votes and phase', async () => {
    const { result } = await room('player');
    await act(async () => {
      await update(ref(db, 'rooms/REVIEW'), { 'meta/phase': 'revealed', 'players/me/vote': '8' });
      await result.current.upsertTasks([{ id: 't1', title: 'First' }, { id: 't2', title: 'Renamed' }]);
    });
    expect(result.current.players.me.vote).toBe('8');
    expect(result.current.phase).toBe('revealed');
  });
});
