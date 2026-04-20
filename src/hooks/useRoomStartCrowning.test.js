/**
 * Regression: the first-leader coronation must fire exactly once per room.
 *
 * Before the `roomStartCrowned` sticky flag was added, every page refresh
 * by the solo leader re-entered the trigger effect with `isLeader=true`,
 * no live `roomStartCrowning` payload, and a one-player roster where
 * `playerIds[0] === playerId` — every guard passed, so the PM walked in,
 * materialised the crown, placed it, and walked off all over again.
 *
 * The fix writes `meta/roomStartCrowned = true` atomically with clearing
 * the payload at ceremony end. The trigger effect reads that flag and
 * bails before touching any other guard.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

vi.mock('../firebase.js', () => import('../test/firebase-mock.js'));

import { useRoomStartCrowning } from './useRoomStartCrowning';
import { __mock, get, ref, db } from '../test/firebase-mock.js';

const SOLO = {
  'p0': { name: 'Alice', role: 'player', joinedAt: Date.now(), isLeader: true },
};

function baseProps(overrides = {}) {
  return {
    roomCode: 'ROOMCR',
    playerId: 'p0',
    role: 'player',
    connected: true,
    isLeader: true,
    players: SOLO,
    roomStartCrowning: null,
    pmRoulette: null,
    ceremonyStartPos: { x: 500, y: 500 },
    roomStartCrowned: false,
    ...overrides,
  };
}

async function readFlag(roomCode) {
  const snap = await get(ref(db, `rooms/${roomCode}/meta/roomStartCrowned`));
  return snap.val();
}

async function readPayload(roomCode) {
  const snap = await get(ref(db, `rooms/${roomCode}/meta/roomStartCrowning`));
  return snap.val();
}

describe('useRoomStartCrowning — first-leader one-shot', () => {
  beforeEach(() => {
    __mock.reset();
    vi.useRealTimers();
  });

  it('writes a payload for the solo first leader when no flag is set', async () => {
    const { rerender } = renderHook((props) => useRoomStartCrowning(props), {
      initialProps: baseProps(),
    });

    // walkInReady gate waits 3s after `connected`. Bail-bounded wait.
    await waitFor(
      async () => expect(await readPayload('ROOMCR')).toBeTruthy(),
      { timeout: 5000 },
    );

    const payload = await readPayload('ROOMCR');
    expect(payload.winnerId).toBe('p0');
    expect(payload.schemaVersion).toBe(1);

    // Simulate the payload propagating back through Firebase subscription:
    // pass it via props (in the real UI this comes from useRoom's onValue).
    rerender(baseProps({ roomStartCrowning: payload }));
  });

  it('does NOT fire when roomStartCrowned is already true (refresh scenario)', async () => {
    // Leader refreshes. Firebase already holds `roomStartCrowned: true`
    // from the earlier ceremony; useRoom reads it and passes it in here.
    const { result } = renderHook(() =>
      useRoomStartCrowning(baseProps({ roomStartCrowned: true })),
    );

    // Give the trigger effect ample time — past the walkInReady gate —
    // to demonstrate that NO payload gets written.
    await new Promise((resolve) => setTimeout(resolve, 3500));

    expect(await readPayload('ROOMCR')).toBeNull();
    // And the hook's published state remains idle.
    expect(result.current.active).toBe(false);
    expect(result.current.phase).toBe('idle');
  });

  // Regression: refreshing DURING the in-flight ceremony must not write
  // a second payload. `roomStartCrowning` is non-null on the new mount
  // (Firebase still holds the active payload), and the top-level guard
  // `if (roomStartCrowning) return;` must prevent re-entry.
  it('does NOT fire a second ceremony when refreshing while the payload is already live', async () => {
    // startedAt is FAR in the future so the animation loop never
    // advances to `done` and cleanupPayload doesn't run during the
    // test window. The only thing we're measuring here is: does the
    // trigger effect short-circuit on `if (roomStartCrowning) return;`
    // and avoid a second write?
    const livePayload = {
      ceremonyId: 'live-1',
      startedAt: Date.now() + 60_000,
      winnerId: 'p0',
      schemaVersion: 1,
    };
    const { set, ref: fbref, db: fbdb } = await import('../test/firebase-mock.js');
    await set(fbref(fbdb, 'rooms/ROOMCR/meta/roomStartCrowning'), livePayload);

    // New mount (post-refresh) — useRoom would be passing the live
    // payload back in; roomStartCrowned is still false because the
    // ceremony hasn't completed yet.
    renderHook(() =>
      useRoomStartCrowning(baseProps({
        roomStartCrowning: livePayload,
        roomStartCrowned: false,
      })),
    );

    // Wait past the walkInReady gate — if the trigger effect were to
    // fire, it would have done so by now.
    await new Promise((resolve) => setTimeout(resolve, 3500));

    // The Firebase payload must still be the SAME ceremonyId — no
    // second write replaced it.
    const after = await readPayload('ROOMCR');
    expect(after).toBeTruthy();
    expect(after.ceremonyId).toBe('live-1');
  });

  // Regression: the StrictMode / double-mount guard also covers the
  // refresh race. If the payload write already landed but the
  // subscription hasn't echoed it back yet on a remount, the
  // transaction's `if (current) return;` branch must prevent the
  // second client instance from clobbering the first payload.
  it('the payload write transaction aborts when a payload is already present', async () => {
    const existingPayload = {
      ceremonyId: 'existing-1',
      startedAt: Date.now(),
      winnerId: 'p0',
      schemaVersion: 1,
    };
    const { set, ref: fbref, db: fbdb } = await import('../test/firebase-mock.js');
    await set(fbref(fbdb, 'rooms/ROOMCR/meta/roomStartCrowning'), existingPayload);

    // Simulate a fresh mount that hasn't received the subscription echo
    // yet — roomStartCrowning prop is null. Trigger effect will try to
    // write, but the transaction must see the existing payload and abort.
    renderHook(() =>
      useRoomStartCrowning(baseProps({
        roomStartCrowning: null,
        roomStartCrowned: false,
      })),
    );
    await new Promise((resolve) => setTimeout(resolve, 3500));

    const after = await readPayload('ROOMCR');
    // The existing payload is untouched — same ceremonyId.
    expect(after.ceremonyId).toBe('existing-1');
  });

  it('cleanupPayload sets the sticky flag atomically with clearing the payload', async () => {
    // Seed a live payload whose startedAt is far enough in the past that
    // the stale-check guard (elapsed > 3500 + 500 ms) triggers
    // cleanupPayload immediately on mount. That's the same code path the
    // end-of-ceremony tick takes, so we exercise the atomic update
    // without having to drive the animation loop.
    const seededPayload = {
      ceremonyId: 'seed-1',
      startedAt: Date.now() - 10_000,
      winnerId: 'p0',
      schemaVersion: 1,
    };
    await import('../test/firebase-mock.js').then(({ set, ref, db }) =>
      set(ref(db, 'rooms/ROOMCR/meta/roomStartCrowning'), seededPayload),
    );

    renderHook(() =>
      useRoomStartCrowning(baseProps({ roomStartCrowning: seededPayload })),
    );

    await waitFor(async () => expect(await readFlag('ROOMCR')).toBe(true), {
      timeout: 2000,
    });
    // Payload was nulled in the same update.
    expect(await readPayload('ROOMCR')).toBeNull();
  });
});
