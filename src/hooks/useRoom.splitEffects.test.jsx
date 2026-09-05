import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('../firebase', () => import('../test/firebase-mock'));
import { useRoom } from './useRoom';
import { __mock } from '../test/firebase-mock';

beforeEach(() => { __mock.reset(); sessionStorage.clear(); });
it('shows the same split intro to PM and player and protects it from ambient effects', async () => {
  const pm = renderHook(() => useRoom('SPL123', 'pm', 'Manager', 'pm'));
  await waitFor(() => expect(pm.result.current.connected).toBe(true));
  const player = renderHook(() => useRoom('SPL123', 'player', 'Alice'));
  await waitFor(() => expect(player.result.current.connected).toBe(true));
  await act(async () => { await pm.result.current.toggleSplit(); });
  await waitFor(() => expect(player.result.current.syncedEvent?.type).toBe('specialRound'));
  expect(player.result.current.splitMode).toBe(true);
  expect(player.result.current.syncedEvent).toEqual(pm.result.current.syncedEvent);
  let accepted;
  await act(async () => { accepted = await pm.result.current.fireSyncedEvent({ type: 'devQuote', text: 'interrupt' }); });
  expect(accepted).toBe(false);
  expect(player.result.current.syncedEvent.type).toBe('specialRound');
  await act(async () => { player.result.current.castVoteFe('5'); player.result.current.castVoteBe('8'); });
  await waitFor(() => expect(pm.result.current.players.player).toMatchObject({ voteFe: '5', voteBe: '8' }));
});
