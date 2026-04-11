import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('../firebase.js', () => import('../test/firebase-mock.js'));

import { useRoom } from './useRoom';
import { __mock } from '../test/firebase-mock.js';

describe('fireSyncedEvent mutex (user requirement: never two entrances at once)', () => {
  beforeEach(() => { __mock.reset(); });

  it('important event (train) blocks a second important event (dbbPipeline)', async () => {
    const { result } = renderHook(() => useRoom('MUTEX1', 'leader-id', 'Leader', 'pm'));
    await waitFor(() => expect(result.current.isLeader).toBe(true));

    let firstResult, secondResult;
    await act(async () => {
      firstResult = await result.current.fireSyncedEvent(
        { type: 'train', playerId: 'richard-id', playerName: 'Richard', fromRight: false },
        5000
      );
    });
    await waitFor(() => expect(result.current.syncedEvent?.type).toBe('train'));

    await act(async () => {
      secondResult = await result.current.fireSyncedEvent(
        { type: 'dbbPipeline', playerId: 'tomas-id', playerName: 'Tomáš', fromSide: 'top' },
        5000
      );
    });

    expect(firstResult).toBe(true);
    expect(secondResult).toBe(false);
    // Train still wins
    expect(result.current.syncedEvent?.type).toBe('train');
    expect(result.current.syncedEvent?.playerName).toBe('Richard');
  });

  it('important event blocks minor events too (devQuote)', async () => {
    const { result } = renderHook(() => useRoom('MUTEX2', 'leader-id', 'Leader', 'pm'));
    await waitFor(() => expect(result.current.isLeader).toBe(true));

    await act(async () => {
      result.current.fireSyncedEvent({ type: 'train', playerId: 'r-id', playerName: 'R', fromRight: false }, 5000);
    });
    await waitFor(() => expect(result.current.syncedEvent?.type).toBe('train'));

    await act(async () => {
      result.current.fireSyncedEvent({ type: 'devQuote', name: 'X', text: 'hi' }, 2000);
    });

    expect(result.current.syncedEvent?.type).toBe('train');
  });

  it('DBB pipeline also blocks a train from firing on top of it', async () => {
    const { result } = renderHook(() => useRoom('MUTEX3', 'leader-id', 'Leader', 'pm'));
    await waitFor(() => expect(result.current.isLeader).toBe(true));

    await act(async () => {
      await result.current.fireSyncedEvent(
        { type: 'dbbPipeline', playerId: 'tomas-id', playerName: 'Tomáš', fromSide: 'left' },
        5000
      );
    });
    await waitFor(() => expect(result.current.syncedEvent?.type).toBe('dbbPipeline'));

    let secondResult;
    await act(async () => {
      secondResult = await result.current.fireSyncedEvent(
        { type: 'train', playerId: 'richard-id', playerName: 'Richard', fromRight: true },
        5000
      );
    });

    expect(secondResult).toBe(false);
    expect(result.current.syncedEvent?.type).toBe('dbbPipeline');
  });

  it('after an important event clears, the next one can fire', async () => {
    const { result } = renderHook(() => useRoom('MUTEX4', 'leader-id', 'Leader', 'pm'));
    await waitFor(() => expect(result.current.isLeader).toBe(true));

    await act(async () => {
      await result.current.fireSyncedEvent({ type: 'train', playerId: 'r-id', playerName: 'R', fromRight: false }, 100);
    });
    await waitFor(() => expect(result.current.syncedEvent?.type).toBe('train'));
    await waitFor(() => expect(result.current.syncedEvent).toBeNull(), { timeout: 1000 });

    // Now DBB should be allowed
    let ok;
    await act(async () => {
      ok = await result.current.fireSyncedEvent(
        { type: 'dbbPipeline', playerId: 'tomas-id', playerName: 'Tomáš', fromSide: 'top' },
        1000
      );
    });
    expect(ok).toBe(true);
    await waitFor(() => expect(result.current.syncedEvent?.type).toBe('dbbPipeline'));
  });
});
