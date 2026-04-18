import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePlayerDirector, __testing__ as directorTesting } from './usePlayerDirector';
import { createStageRuntime } from './useCharacterStage';
import { ACTION_TYPES } from '../engine/character';
import { computePlayerGridPosition } from '../engine/gridPosition';

// Helper produces fresh joiners (joinedAt ~= now) so they land in the
// walk-in branch of usePlayerDirector. Tests that simulate a refresh /
// reconnect use an older joinedAt explicitly (see `playersOld`).
function players(...names) {
  const out = {};
  const now = Date.now();
  names.forEach((n, i) => {
    out[`p${i}`] = { name: n, role: 'player', joinedAt: now - 100 + i };
  });
  return out;
}

beforeEach(() => {
  // computePlayerGridPosition reads window.innerWidth; jsdom default 1024 is fine.
});

describe('usePlayerDirector — join / leave / reshuffle', () => {
  it('creates one character per non-PM player and queues a walk-in to the grid center', () => {
    const stage = createStageRuntime();
    const initial = players('Alice', 'Bob');
    renderHook(({ players: p }) => usePlayerDirector({ stage, players: p }),
      { initialProps: { players: initial } });

    expect(stage.has('player-p0')).toBe(true);
    expect(stage.has('player-p1')).toBe(true);
    expect(stage.size()).toBe(2);

    // Both characters should currently be executing a walkTo toward the grid.
    const vw = window.innerWidth;
    const target0 = computePlayerGridPosition(0, 2, vw);
    const a = stage.get('player-p0');
    // Walk-in action is queued; tick once to pop it into char.action.
    stage.tick(0);
    expect(a.action?.type).toBe(ACTION_TYPES.WALK_TO);
    expect(a.action.x).toBeCloseTo(target0.x, 0);
    expect(a.action.from.x < 0 || a.action.from.x > vw).toBe(true); // offscreen
  });

  it('removes a leaving player via a walkTo-to-offscreen then stage.remove', () => {
    const stage = createStageRuntime();
    const p = players('Alice', 'Bob');
    const { rerender } = renderHook(({ players }) =>
      usePlayerDirector({ stage, players }),
    { initialProps: { players: p } });

    // Sanity: both characters should be on the stage after initial mount.
    expect(stage.has('player-p0')).toBe(true);
    expect(stage.has('player-p1')).toBe(true);

    // Bob leaves
    rerender({ players: { p0: p.p0 } });
    const bob = stage.get('player-p1');
    expect(bob).toBeDefined();
    // Walk-off queued; drain to get the action, then to completion.
    stage.tick(0);
    expect(bob.action?.type).toBe(ACTION_TYPES.WALK_TO);
    const vw0 = window.innerWidth;
    expect(bob.action.x < 0 || bob.action.x > vw0).toBe(true); // target offscreen
    stage.tick(100000);
    expect(stage.has('player-p1')).toBe(false);
  });

  it('does not re-create / churn characters on cosmetic rerenders', () => {
    const stage = createStageRuntime();
    const p = players('Alice', 'Bob');
    const { rerender } = renderHook(({ players, shameStage }) =>
      usePlayerDirector({ stage, players, shameStage }),
    { initialProps: { players: p, shameStage: 0 } });
    const alice = stage.get('player-p0');
    rerender({ players: p, shameStage: 2 });
    rerender({ players: p, shameStage: 3 });
    expect(stage.get('player-p0')).toBe(alice);
  });

  it('reshuffles an existing player when a new player widens the grid', () => {
    const stage = createStageRuntime();
    const p = players('Alice');
    const { rerender } = renderHook(({ players }) =>
      usePlayerDirector({ stage, players }),
    { initialProps: { players: p } });
    const alice = stage.get('player-p0');
    // Finish Alice's join walk so she's sitting on her slot.
    stage.tick(0);
    stage.tick(100000);
    const soloCenter = computePlayerGridPosition(0, 1, window.innerWidth);
    expect(alice.position.x).toBeCloseTo(soloCenter.x, 0);

    rerender({ players: players('Alice', 'Bob') });
    // Alice's slot just shifted left (grid is wider with two players).
    const duoCenter0 = computePlayerGridPosition(0, 2, window.innerWidth);
    expect(duoCenter0.x).not.toBeCloseTo(soloCenter.x, 0);
    // Reshuffle walk queued — pop it onto char.action.
    stage.tick(1);
    expect(alice.action?.type).toBe(ACTION_TYPES.WALK_TO);
    expect(alice.action.x).toBeCloseTo(duoCenter0.x, 0);
  });
});

describe('usePlayerDirector — outgoing leader handoff (Phase 4)', () => {
  it('keeps the outgoing-leader character alive through the ceremony even if they disconnected', () => {
    const stage = createStageRuntime();
    const p = players('Alice', 'Bob');
    // Alice is about to be dethroned. Render, let her settle.
    const { rerender } = renderHook(({ players, pmRoulette }) =>
      usePlayerDirector({ stage, players, pmRoulette }),
    { initialProps: { players: p, pmRoulette: null } });

    // Ceremony starts — Alice becomes the outgoing leader.
    const ceremony = {
      ceremonyId: 'c1',
      startedAt: Date.now() + 60_000, // comfortably in the future so the walk-off timer won't fire yet
      outgoingLeaderId: 'p0',
      outgoingLeaderLastData: { name: 'Alice', role: 'player' },
      outgoingLeaderHadCrown: true,
    };
    // Alice's session drops out of the players map while she's the outgoing leader.
    rerender({ players: { p1: p.p1 }, pmRoulette: ceremony });

    // Her character must still be on the stage, not removed.
    expect(stage.has('player-p0')).toBe(true);
  });

  // Regression: previously the outgoing leader was walked off 3s into
  // the ceremony. That meant by the time Act 1 crown-removal finished
  // (5s) the figure was already halfway offscreen, and the PM was
  // miming crown-lift over an empty slot. The new contract keeps the
  // figure rooted for the whole ceremony and only walks them off after
  // the new leader is crowned (pmRoulette → null).
  it('does NOT walk off the outgoing leader while the ceremony is still active', () => {
    const stage = createStageRuntime();
    const p = players('Alice', 'Bob');
    const { rerender } = renderHook(({ players, pmRoulette }) =>
      usePlayerDirector({ stage, players, pmRoulette }),
    { initialProps: { players: p, pmRoulette: null } });

    // Settle Alice on her slot.
    stage.tick(0);
    stage.tick(100000);
    const alice = stage.get('player-p0');
    const settledX = alice.position.x;

    // Ceremony started a long time ago — far past the old 3s walk-off
    // threshold — yet while pmRoulette is set the figure must NOT walk off.
    const ceremony = {
      ceremonyId: 'c1',
      startedAt: Date.now() - 10_000,
      outgoingLeaderId: 'p0',
      outgoingLeaderLastData: { name: 'Alice', role: 'player' },
      outgoingLeaderHadCrown: true,
    };
    // Simulate post-promotion state: Alice is marked disconnected and
    // has had her isLeader stripped by the crownDelivery promotion.
    rerender({
      players: {
        p0: { ...p.p0, isLeader: false, disconnected: true },
        p1: p.p1,
      },
      pmRoulette: ceremony,
    });

    stage.tick(0);
    // Either no action at all, or a no-op action — definitely not a
    // walkTo toward offscreen.
    const act = alice.action;
    if (act?.type === ACTION_TYPES.WALK_TO) {
      const vw = window.innerWidth;
      expect(act.x >= 0 && act.x <= vw).toBe(true);
    }
    expect(alice.position.x).toBeCloseTo(settledX, 0);
    expect(stage.has('player-p0')).toBe(true);
  });

  // Regression for the user-reported bug: when the leader closes their
  // browser, `disconnected: true` lands on their node ~5 seconds before
  // the ceremony trigger writes pmRoulette. During that grace window
  // the figure must stay put, not start walking off — otherwise the PM
  // walks up to an empty slot.
  it('keeps a disconnected-but-still-leader figure rooted during the pre-ceremony grace window', () => {
    const stage = createStageRuntime();
    const p = players('Alice', 'Bob');
    // Alice is the room leader.
    p.p0.isLeader = true;
    const { rerender } = renderHook(({ players, pmRoulette }) =>
      usePlayerDirector({ stage, players, pmRoulette }),
    { initialProps: { players: p, pmRoulette: null } });

    stage.tick(0);
    stage.tick(100000);
    const alice = stage.get('player-p0');
    const settledX = alice.position.x;

    // Alice closes her browser → onDisconnect sets disconnected: true.
    // pmRoulette is still null (ceremony hasn't fired yet).
    rerender({
      players: {
        p0: { ...p.p0, disconnected: true }, // isLeader still true
        p1: p.p1,
      },
      pmRoulette: null,
    });

    stage.tick(0);
    stage.tick(100);
    // No walk-off must have been queued.
    const act = alice.action;
    if (act?.type === ACTION_TYPES.WALK_TO) {
      const vw = window.innerWidth;
      expect(act.x >= 0 && act.x <= vw).toBe(true);
    }
    expect(alice.position.x).toBeCloseTo(settledX, 0);
    expect(stage.has('player-p0')).toBe(true);
  });

  // Walk-off fires only when the ceremony payload clears (new leader has
  // been crowned and clearPmRoulette has run).
  it('queues the outgoing-leader walk-off when pmRoulette transitions to null', () => {
    const stage = createStageRuntime();
    const p = players('Alice', 'Bob');
    p.p0.isLeader = true;
    const { rerender } = renderHook(({ players, pmRoulette }) =>
      usePlayerDirector({ stage, players, pmRoulette }),
    { initialProps: { players: p, pmRoulette: null } });

    // Settle.
    stage.tick(0);
    stage.tick(100000);
    const alice = stage.get('player-p0');

    // Ceremony starts; Alice is the outgoing leader.
    const ceremony = {
      ceremonyId: 'c1',
      startedAt: Date.now(),
      outgoingLeaderId: 'p0',
      outgoingLeaderLastData: { name: 'Alice', role: 'player' },
      outgoingLeaderHadCrown: true,
    };
    rerender({
      players: {
        p0: { ...p.p0, disconnected: true },
        p1: p.p1,
      },
      pmRoulette: ceremony,
    });
    stage.tick(0);

    // Mid-ceremony: crownDelivery promoted the next leader, so Alice's
    // isLeader flag has flipped to false. She's still kept visible by
    // the pmRoulette.outgoingLeaderId injection.
    rerender({
      players: {
        p0: { ...p.p0, isLeader: false, disconnected: true },
        p1: p.p1,
      },
      pmRoulette: ceremony,
    });
    stage.tick(0);
    expect(stage.has('player-p0')).toBe(true);

    // Ceremony ends: clearPmRoulette wipes the payload.
    rerender({
      players: {
        p0: { ...p.p0, isLeader: false, disconnected: true },
        p1: p.p1,
      },
      pmRoulette: null,
    });
    stage.tick(0);
    expect(alice.action?.type).toBe(ACTION_TYPES.WALK_TO);
    const vw = window.innerWidth;
    expect(alice.action.x < 0 || alice.action.x > vw).toBe(true);

    // And the character is removed once the walk completes.
    stage.tick(100000);
    expect(stage.has('player-p0')).toBe(false);
  });
});

describe('usePlayerDirector — slow-state mirror', () => {
  it('writes shame tremble class on the character during an active shame timer', () => {
    const stage = createStageRuntime();
    const p = players('Alice', 'Bob');
    const { rerender } = renderHook(({ shameTimer, shameStage }) =>
      usePlayerDirector({
        stage, players: p,
        shameTimer, shameStage,
      }),
    { initialProps: { shameTimer: null, shameStage: 0 } });

    rerender({
      shameTimer: { holdoutId: 'p1', holdoutName: 'Bob', startedAt: Date.now() },
      shameStage: 3,
    });
    expect(stage.get('player-p1').className).toContain('shame-tremble-3');
    expect(stage.get('player-p1').stressStage).toBe(3);
    expect(stage.get('player-p0').className).toBe('');
  });

  it('writes player-nod class when everyone has voted', () => {
    const stage = createStageRuntime();
    const p = players('Alice', 'Bob');
    const { rerender } = renderHook(({ allVoted }) =>
      usePlayerDirector({ stage, players: p, allVoted }),
    { initialProps: { allVoted: false } });

    expect(stage.get('player-p0').className).toBe('');
    rerender({ allVoted: true });
    expect(stage.get('player-p0').className).toContain('player-nod');
    expect(stage.get('player-p1').className).toContain('player-nod');
  });

  it('lights up fukEyes when the player is in the ambient fuk-eyes set', () => {
    const stage = createStageRuntime();
    const p = players('Alice', 'Fanda');
    const { rerender } = renderHook(({ fukEyesSet }) =>
      usePlayerDirector({ stage, players: p, fukEyesSet }),
    { initialProps: { fukEyesSet: new Set() } });
    expect(stage.get('player-p1').fukEyes).toBe(false);
    rerender({ fukEyesSet: new Set(['Fanda']) });
    expect(stage.get('player-p1').fukEyes).toBe(true);
  });

});

describe('usePlayerDirector — no stage is a no-op', () => {
  it('does not throw when stage is null (used by unit-test rigs of usePlayerModels)', () => {
    const p = players('Alice');
    expect(() =>
      renderHook(() => usePlayerDirector({ stage: null, players: p })),
    ).not.toThrow();
  });
});

describe('usePlayerDirector — refresh / reconnect', () => {
  // sessionStorage persists across tests in jsdom, and the mid-walk-in
  // refresh regression test deliberately writes a walked-in flag that
  // would otherwise bleed into the "genuinely fresh joiner" test and
  // make it teleport. Clear per test.
  beforeEach(() => {
    try { window.sessionStorage.clear(); } catch { /* noop */ }
  });

  // Regression: before this branch existed, every first-mount of the
  // director placed every character at offscreenX and walked them in,
  // regardless of how long the player had actually been in the room.
  // A refreshing leader therefore saw a second copy of themselves walk
  // in from the edge while their "real" figure remained standing at
  // the grid slot. The age check teleports an already-present player
  // straight into their slot so the refresh looks like no animation at all.
  it('places an already-present player directly at their grid slot (no walk-in from offscreen)', () => {
    const stage = createStageRuntime();
    const vw = window.innerWidth;
    // Player has been in the room for longer than JOIN_WINDOW_MS → the
    // director should treat this as a reconnect, not a fresh join.
    const p = {
      p0: {
        name: 'Alice',
        role: 'player',
        joinedAt: Date.now() - (directorTesting.JOIN_WINDOW_MS + 60_000),
      },
    };
    renderHook(() => usePlayerDirector({ stage, players: p }));

    const alice = stage.get('player-p0');
    const slot = computePlayerGridPosition(0, 1, vw);
    // Figure sits on its slot — not offscreen.
    expect(alice.position.x).toBeCloseTo(slot.x, 0);
    expect(alice.position.y).toBeCloseTo(slot.y, 0);

    // And no walk-in action was queued. Either no action at all, or
    // something that is explicitly NOT a walkTo away from the slot.
    stage.tick(0);
    const act = alice.action;
    if (act?.type === ACTION_TYPES.WALK_TO) {
      // If there is a walkTo it must be to the very slot we're already on
      // (i.e. effectively a no-op), not from an offscreen origin.
      expect(act.x).toBeCloseTo(slot.x, 0);
      expect(act.from.x).toBeCloseTo(slot.x, 0);
    }
  });

  it('still walks in a genuinely fresh joiner (joinedAt within JOIN_WINDOW_MS)', () => {
    const stage = createStageRuntime();
    const vw = window.innerWidth;
    const p = {
      p0: {
        name: 'Alice',
        role: 'player',
        joinedAt: Date.now() - 200,
      },
    };
    renderHook(() => usePlayerDirector({ stage, players: p }));

    const alice = stage.get('player-p0');
    // Starts offscreen.
    expect(alice.position.x < 0 || alice.position.x > vw).toBe(true);
    // Walk-in queued toward the slot.
    stage.tick(0);
    const slot = computePlayerGridPosition(0, 1, vw);
    expect(alice.action?.type).toBe(ACTION_TYPES.WALK_TO);
    expect(alice.action.x).toBeCloseTo(slot.x, 0);
  });

  // Regression for the user-reported bug: pressing Ctrl+R WHILE the
  // character is still walking in (joinedAt age ~2s, well within
  // JOIN_WINDOW_MS) used to replay the walk-in on the remount because
  // the age check classified the player as a fresh joiner. Visually this
  // read as the character being duplicated — the user saw the same
  // entrance play twice. The sessionStorage "already walked in this tab"
  // flag catches this case: first mount sets the flag atomically with
  // scheduling the walkTo, so the next mount in the same tab teleports
  // regardless of how recent `joinedAt` is.
  it('teleports on mid-walk-in refresh (sessionStorage flag set on first mount)', () => {
    try { window.sessionStorage.clear(); } catch { /* noop */ }

    const stage1 = createStageRuntime();
    const vw = window.innerWidth;
    const joinedAt = Date.now() - 100; // squarely inside JOIN_WINDOW_MS
    const p = { p0: { name: 'Alice', role: 'player', joinedAt } };

    // First mount: walk-in scheduled, flag set.
    const { unmount } = renderHook(() =>
      usePlayerDirector({ stage: stage1, players: p, roomCode: 'ROOMMW' }),
    );
    stage1.tick(0);
    // Sanity: first mount actually walked her in.
    expect(stage1.get('player-p0').action?.type).toBe(ACTION_TYPES.WALK_TO);
    const storageKey = directorTesting.walkInStorageKey('ROOMMW', 'player-p0');
    expect(window.sessionStorage.getItem(storageKey)).toBe('1');
    unmount();

    // Simulate Ctrl+R: brand new stage, same sessionStorage (same tab).
    // `joinedAt` is still fresh — the age window alone would mis-classify
    // this as a fresh joiner. The sessionStorage flag must override.
    const stage2 = createStageRuntime();
    renderHook(() =>
      usePlayerDirector({ stage: stage2, players: p, roomCode: 'ROOMMW' }),
    );
    const alice = stage2.get('player-p0');
    const slot = computePlayerGridPosition(0, 1, vw);
    // Placed directly at the slot, no offscreen start.
    expect(alice.position.x).toBeCloseTo(slot.x, 0);
    expect(alice.position.y).toBeCloseTo(slot.y, 0);

    stage2.tick(0);
    // No walkTo from offscreen queued.
    const act = alice.action;
    if (act?.type === ACTION_TYPES.WALK_TO) {
      expect(act.from.x).toBeCloseTo(slot.x, 0);
    }
  });

  it('scopes the walked-in flag by room — moving to a different room still walks in', () => {
    try { window.sessionStorage.clear(); } catch { /* noop */ }

    const stage1 = createStageRuntime();
    const vw = window.innerWidth;
    const p = { p0: { name: 'Alice', role: 'player', joinedAt: Date.now() - 100 } };

    const { unmount } = renderHook(() =>
      usePlayerDirector({ stage: stage1, players: p, roomCode: 'ROOM-A' }),
    );
    stage1.tick(0);
    unmount();

    // Different room — flag is scoped by room code, so this must walk in.
    const stage2 = createStageRuntime();
    renderHook(() =>
      usePlayerDirector({ stage: stage2, players: p, roomCode: 'ROOM-B' }),
    );
    const alice = stage2.get('player-p0');
    expect(alice.position.x < 0 || alice.position.x > vw).toBe(true); // offscreen start
  });

  // Three refreshes in rapid succession — the flag is sticky for the
  // whole tab lifetime and must keep teleporting. Protects against a
  // future refactor that might clear the flag on unmount, set it with
  // a TTL, or otherwise scope it too narrowly.
  it('every subsequent mount in the same tab teleports — flag is sticky, not one-shot', () => {
    try { window.sessionStorage.clear(); } catch { /* noop */ }

    const vw = window.innerWidth;
    const slot = computePlayerGridPosition(0, 1, vw);
    const p = { p0: { name: 'Alice', role: 'player', joinedAt: Date.now() - 100 } };

    // First mount → walks in (and writes the flag).
    const stage0 = createStageRuntime();
    const { unmount: u0 } = renderHook(() =>
      usePlayerDirector({ stage: stage0, players: p, roomCode: 'ROOMPRS' }),
    );
    stage0.tick(0);
    u0();

    // Three consecutive refreshes — every one must teleport.
    for (let refresh = 1; refresh <= 3; refresh++) {
      const stage = createStageRuntime();
      const { unmount } = renderHook(() =>
        usePlayerDirector({ stage, players: p, roomCode: 'ROOMPRS' }),
      );
      const alice = stage.get('player-p0');
      expect(alice.position.x, `refresh #${refresh}`).toBeCloseTo(slot.x, 0);
      unmount();
    }
  });

  // Belt-and-suspenders: if sessionStorage throws on read (private mode,
  // quota, extensions blocking storage), the age check alone must still
  // be correct for the common case of a genuinely-old player. This
  // keeps the fix robust even when storage isn't available.
  it('falls back to age check when sessionStorage reads throw', () => {
    const originalGetItem = window.sessionStorage.getItem;
    window.sessionStorage.getItem = () => { throw new Error('storage disabled'); };
    try {
      const stage = createStageRuntime();
      const vw = window.innerWidth;
      const slot = computePlayerGridPosition(0, 1, vw);
      // Old player — age check alone should teleport even without the flag.
      const p = {
        p0: {
          name: 'Alice',
          role: 'player',
          joinedAt: Date.now() - (directorTesting.JOIN_WINDOW_MS + 60_000),
        },
      };
      renderHook(() =>
        usePlayerDirector({ stage, players: p, roomCode: 'ROOMNF' }),
      );
      const alice = stage.get('player-p0');
      expect(alice.position.x).toBeCloseTo(slot.x, 0);
      expect(alice.position.y).toBeCloseTo(slot.y, 0);
    } finally {
      window.sessionStorage.getItem = originalGetItem;
    }
  });

  // Symmetry check: if sessionStorage writes throw, the initial walk-in
  // must NOT be broken. The user still sees a walk-in (age check says
  // fresh), and the hook doesn't crash the app. On refresh the flag is
  // absent so the figure will walk in again — that's the private-mode
  // compromise, but strictly better than a thrown exception.
  it('does not throw when sessionStorage writes fail', () => {
    const originalSetItem = window.sessionStorage.setItem;
    window.sessionStorage.setItem = () => { throw new Error('quota'); };
    try {
      const stage = createStageRuntime();
      const p = { p0: { name: 'Alice', role: 'player', joinedAt: Date.now() - 100 } };
      expect(() =>
        renderHook(() =>
          usePlayerDirector({ stage, players: p, roomCode: 'ROOMNW' }),
        ),
      ).not.toThrow();
      // Character still exists and the walk-in was scheduled.
      expect(stage.has('player-p0')).toBe(true);
      stage.tick(0);
      expect(stage.get('player-p0').action?.type).toBe(ACTION_TYPES.WALK_TO);
    } finally {
      window.sessionStorage.setItem = originalSetItem;
    }
  });

  // Key-format lock-in: if anyone renames the storage key in one place
  // without updating the other, the reader/writer drift silently and
  // the flag never catches refresh. Pin the exact key format so that
  // accident is caught immediately.
  it('writes the sessionStorage flag at the exact key the helper reads', () => {
    try { window.sessionStorage.clear(); } catch { /* noop */ }
    const stage = createStageRuntime();
    const p = { p0: { name: 'Alice', role: 'player', joinedAt: Date.now() - 100 } };
    renderHook(() =>
      usePlayerDirector({ stage, players: p, roomCode: 'KEYTEST' }),
    );
    // Exact key format — both the reader and the writer must agree.
    expect(window.sessionStorage.getItem('poker-walkedin:KEYTEST:player-p0')).toBe('1');
    expect(directorTesting.hasWalkedInThisSession('KEYTEST', 'player-p0')).toBe(true);
    expect(directorTesting.walkInStorageKey('KEYTEST', 'player-p0'))
      .toBe('poker-walkedin:KEYTEST:player-p0');
  });

  // The flag must be set ONLY when a walkTo is actually scheduled.
  // Setting it indiscriminately (e.g. before the fresh-join branch)
  // would cause the very bug we're preventing: a genuinely-old player
  // would mark themselves, and a second tab viewing them would — if we
  // ever pivoted to a shared storage backend — teleport when they
  // should walk in. Lock the contract.
  it('does NOT write the sessionStorage flag when the player is teleported (already present)', () => {
    try { window.sessionStorage.clear(); } catch { /* noop */ }
    const stage = createStageRuntime();
    // Old player → teleport path, no walkTo.
    const p = {
      p0: {
        name: 'Alice',
        role: 'player',
        joinedAt: Date.now() - (directorTesting.JOIN_WINDOW_MS + 60_000),
      },
    };
    renderHook(() =>
      usePlayerDirector({ stage, players: p, roomCode: 'NOFLAGRM' }),
    );
    // Crucial: the flag was NOT written because no walkTo was scheduled.
    expect(window.sessionStorage.getItem('poker-walkedin:NOFLAGRM:player-p0')).toBeNull();
  });

  // Multi-player scope: flag is keyed per charId, so the leader's flag
  // (set on their first mount) must not prevent a newly-joining
  // teammate from walking in on the same tab.
  it('does not leak the self flag onto another joining player', () => {
    try { window.sessionStorage.clear(); } catch { /* noop */ }
    const stage = createStageRuntime();
    const vw = window.innerWidth;
    const now = Date.now();
    // Initial mount with just the leader.
    const { rerender } = renderHook(
      ({ players }) =>
        usePlayerDirector({ stage, players, roomCode: 'MULTIR' }),
      {
        initialProps: {
          players: { p0: { name: 'Alice', role: 'player', joinedAt: now - 100 } },
        },
      },
    );
    stage.tick(0);
    // Alice walked in. Now Bob joins fresh — he should ALSO walk in,
    // because the flag is per-charId and Bob has never walked in before.
    rerender({
      players: {
        p0: { name: 'Alice', role: 'player', joinedAt: now - 100 },
        p1: { name: 'Bob', role: 'player', joinedAt: now },
      },
    });
    stage.tick(0);
    const bob = stage.get('player-p1');
    expect(bob).toBeDefined();
    expect(bob.position.x < 0 || bob.position.x > vw).toBe(true); // offscreen
    expect(bob.action?.type).toBe(ACTION_TYPES.WALK_TO);
  });

  // Final end-to-end guard: full "user refreshes during arrival"
  // journey, exactly as the user reported. Simulate the complete cycle:
  // first mount mid-walk-in → unmount (Ctrl+R) → remount with the same
  // joinedAt → verify the character is at the slot on the very first
  // frame (no frame where the character is offscreen).
  it('end-to-end: user refreshes while their figure is still arriving, sees no duplicate entrance', () => {
    try { window.sessionStorage.clear(); } catch { /* noop */ }
    const joinedAt = Date.now() - 2000; // 2s into walk-in — well within JOIN_WINDOW_MS
    const p = { p0: { name: 'Alice', role: 'player', joinedAt } };

    // Tab 1, mount 1 — walk-in begins.
    const stage1 = createStageRuntime();
    const r1 = renderHook(() =>
      usePlayerDirector({ stage: stage1, players: p, roomCode: 'E2E' }),
    );
    stage1.tick(0);
    const vw = window.innerWidth;
    // Sanity: walked in from offscreen.
    const aliceFirstMount = stage1.get('player-p0');
    expect(aliceFirstMount.action?.type).toBe(ACTION_TYPES.WALK_TO);
    expect(aliceFirstMount.action.from.x < 0 || aliceFirstMount.action.from.x > vw).toBe(true);
    r1.unmount();

    // Ctrl+R — same tab, same sessionStorage, same joinedAt.
    const stage2 = createStageRuntime();
    renderHook(() =>
      usePlayerDirector({ stage: stage2, players: p, roomCode: 'E2E' }),
    );
    const aliceSecondMount = stage2.get('player-p0');
    const slot = computePlayerGridPosition(0, 1, vw);
    // MUST be at the slot on the very first frame — no offscreen start,
    // no walkTo queued from offscreen.
    expect(aliceSecondMount.position.x).toBeCloseTo(slot.x, 0);
    expect(aliceSecondMount.position.y).toBeCloseTo(slot.y, 0);
    stage2.tick(0);
    const act = aliceSecondMount.action;
    if (act?.type === ACTION_TYPES.WALK_TO) {
      // Any residual action must start at (and effectively stay at) the slot.
      expect(act.from.x).toBeCloseTo(slot.x, 0);
    }
  });
});
