import { StrictMode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../firebase.js', () => import('../test/firebase-mock.js'));
import { useRoom } from './useRoom';
import { __mock, db, ref, update } from '../test/firebase-mock';

const join = (id, deviceId = 'laptop', extra = {}, role = 'player') => renderHook(
  () => useRoom('DUP123', id, 'Alice', role, [], { deviceId, ...extra }),
  { wrapper: StrictMode },
);
const ready = client => waitFor(() => expect(Object.keys(client.result.current.players).length).toBeGreaterThan(0));

describe('duplicate connection takeover', () => {
  beforeEach(() => { __mock.reset(); sessionStorage.clear(); });

  it('transfers normal and split votes exactly once, revokes stale actions and isolates old disconnect', async () => {
    const old = join('old');
    await ready(old);
    await act(async () => {
      await old.result.current.castVote('13');
      await old.result.current.castVoteFe('?');
      await old.result.current.castVoteBe('☕');
    });
    await waitFor(() => expect(old.result.current.players.old.voteBe).toBe('☕'));
    const staleVote = old.result.current.castVote;
    const staleReveal = old.result.current.revealCards;
    const next = join('new');
    await waitFor(() => expect(next.result.current.players.new?.vote).toBe('13'));
    expect(next.result.current.players.new).toMatchObject({ voteFe: '?', voteBe: '☕', isLeader: true });
    expect(Object.keys(next.result.current.players)).toEqual(['new']);
    expect(old.result.current.sessionReplaced).toBe(true);
    expect(old.result.current.sessionEnded).toBe(false);
    expect(old.result.current.isLeader).toBe(false);
    expect(Object.keys(next.result.current.sessionEvictions)).toEqual(['old']);
    await act(async () => {
      await staleVote('21');
      await staleReveal();
      __mock.triggerDisconnect('rooms/DUP123/players/old');
    });
    expect(next.result.current.players.new).toMatchObject({ vote: '13', disconnected: false });
    expect(next.result.current.phase).toBe('voting');
    expect(await next.result.current.fireSyncedEvent({ type: 'train' }, 9000)).toBe(false);
    await waitFor(() => expect(old.result.current.sessionEnded).toBe(true), { timeout: 8000 });
    await act(async () => { await next.result.current.castVote('8'); });
    expect(old.result.current.players.new.vote).toBe('13'); // unsubscribed
    expect(next.result.current.players.new.vote).toBe('8');
  }, 12000);

  it('keeps same-name users on different browsers independent', async () => {
    const a = join('a', 'device-a'); await ready(a);
    const b = join('b', 'device-b');
    await waitFor(() => expect(Object.keys(b.result.current.players)).toHaveLength(2));
    expect(b.result.current.sessionEvictions).toBeNull();
    expect(a.result.current.sessionReplaced).toBe(false);
  });

  it('restores presence after a network flap without reclaiming a newer session', async () => {
    const old = join('old'); await ready(old);
    await act(async () => {
      __mock.setConnectedState(false);
      __mock.triggerDisconnect('rooms/DUP123/players/old');
      __mock.setConnectedState(true);
    });
    await waitFor(() => expect(old.result.current.players.old.disconnected).toBe(false));
    const next = join('next');
    await waitFor(() => expect(next.result.current.players.next).toBeDefined());
    await act(async () => {
      __mock.setConnectedState(false);
      __mock.setConnectedState(true);
    });
    expect(Object.keys(next.result.current.players)).toEqual(['next']);
    expect(old.result.current.sessionReplaced).toBe(true);
  });

  it('refresh preserves a partial split vote, PM role and leadership without a hammer event', async () => {
    const old = join('old', 'laptop', {}, 'pm'); await ready(old);
    await act(async () => { await update(ref(db, 'rooms/DUP123/players/old'), { voteFe: '5' }); });
    old.unmount();
    const refreshed = join('refresh', 'laptop', { previousPlayerId: 'old' });
    await waitFor(() => expect(refreshed.result.current.players.refresh?.voteFe).toBe('5'));
    expect(refreshed.result.current.players.refresh).toMatchObject({ role: 'pm', isLeader: true });
    expect(refreshed.result.current.players.refresh.voteBe ?? null).toBeNull();
    expect(refreshed.result.current.sessionEvictions).toBeNull();
  });

  it('serializes two rapid duplicate joins and never allows a retired tab to reclaim the room', async () => {
    const old = join('old'); await ready(old);
    const b = join('b');
    const c = join('c');
    await waitFor(() => expect(c.result.current.players.c).toBeDefined());
    expect(Object.keys(c.result.current.players)).toEqual(['c']);
    const events = Object.values(c.result.current.sessionEvictions).sort((a, b) => a.startedAt - b.startedAt);
    expect(events).toHaveLength(2);
    expect(events[1].startedAt).toBeGreaterThanOrEqual(events[0].expiresAt);
    old.unmount(); b.unmount();
    const reload = join('reload', 'laptop', { previousPlayerId: 'old' });
    await waitFor(() => expect(reload.result.current.sessionEnded).toBe(true));
    expect(Object.keys(c.result.current.players)).toEqual(['c']);
  });

  it('a late coronation promotes the replacement instead of resurrecting its retired winner', async () => {
    const observer = join('observer', 'other-device'); await ready(observer);
    const old = join('old');
    await waitFor(() => expect(old.result.current.players.old).toBeDefined());
    const next = join('next');
    await waitFor(() => expect(next.result.current.players.next).toBeDefined());
    await act(async () => {
      await observer.result.current.resolvePmRoulettePromotion({ winnerId: 'old' });
    });
    expect(next.result.current.players.next.isLeader).toBe(true);
    expect(__mock.getStore().rooms.DUP123.players.old.isLeader).toBe(false);
    expect(Object.values(next.result.current.players).filter(p => p.isLeader)).toHaveLength(1);
  });
});
