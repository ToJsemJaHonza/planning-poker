import { useState, useEffect, useCallback, useRef } from 'react';
import { db, ref, set, get, update, remove, onValue, onDisconnect, runTransaction, serverTimestamp } from '../firebase';
import {
  buildCeremonyPayload,
  isValidCeremonyPayload,
  isStalePayload,
  nonPmCandidatesSorted,
  SCHEMA_VERSION,
} from '../events/slotMachine';
import { computeStats, roundToCard } from '../components/resultModal.utils';
import { normalizeUrl } from '../components/urls.utils';

// Important events are mutually exclusive cinematics — once one is playing
// in a room, nothing (not even another important event) can overwrite it
// until its TTL expires.
const IMPORTANT_EVENTS = ['train', 'chicken', 'dbbPipeline'];

// Grace window before the crown-handover ceremony fires for a disconnected
// leader. Must comfortably exceed a page refresh round-trip (auth +
// websocket + setupPlayer) on a slow/cold network; the previous 5 s value
// reliably triggered a ceremony every time the leader pressed F5.
// 10 s: still buffers a healthy refresh round-trip while making a genuine
// departure feel snappier than the previous 15 s.
// Exported so integration tests can wait for a post-grace outcome using
// `CEREMONY_GRACE_MS + margin`.
export const CEREMONY_GRACE_MS = 10000;

// Defense-in-depth: reject any room code containing characters that would
// change the Firebase path shape. Firebase RTDB treats `/` as a path
// separator, and `. # $ [ ]` are disallowed key characters — if any of
// those slip into a code they could let a crafted URL param inject extra
// path segments into every write. generateRoomCode always produces
// A–Z/2–9 strings, so this check is a no-op for the legitimate flow.
// Callers (App.getRoomFromURL, Landing.handleJoin) additionally enforce
// the full 6-char shape before getting here.
const ROOM_CODE_INVALID_RE = /[./#$[\]]/;
const isSafeRoomCode = (code) =>
  typeof code === 'string' && code.length > 0 && !ROOM_CODE_INVALID_RE.test(code);

// Fire-and-forget write helper: log errors to the console so a dropped
// network write doesn't vanish silently.
const safeWrite = (promise) => {
  Promise.resolve(promise).catch((err) => console.error('[useRoom] write failed', err));
  return promise;
};

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// Build the initial meta/taskList payload from a normalized initialTasks
// array. Ids are generated internally (`t1`, `t2`, …) so no Firebase-unsafe
// character from user input can ever land in a path key.
function buildInitialTaskList(initialTasks) {
  if (!Array.isArray(initialTasks) || initialTasks.length === 0) return null;
  const items = {};
  initialTasks.forEach((t, i) => {
    const id = `t${i + 1}`;
    items[id] = {
      title: t.title,
      url: t.url ?? null,
      order: i,
      score: null,
      scoreFe: null,
      scoreBe: null,
      scoredAt: null,
    };
  });
  return { activeId: 't1', items };
}

// Helper: finalize the active item's score + pick the next pending id.
// Returns the partial updates object so the caller can fold it into the
// rest of the newRound multi-path update.
function computeTaskListUpdates({ taskList, players, splitMode, roomCode }) {
  if (!taskList || !taskList.activeId || !taskList.items?.[taskList.activeId]) {
    return {};
  }
  const activeId = taskList.activeId;
  const voting = Object.values(players || {}).filter(
    (p) => p && p.role !== 'pm' && !p.disconnected,
  );
  const updates = {};

  if (splitMode) {
    const feStats = computeStats(voting.filter((p) => p.voteFe != null).map((p) => ({ vote: p.voteFe })));
    const beStats = computeStats(voting.filter((p) => p.voteBe != null).map((p) => ({ vote: p.voteBe })));
    const scoreFe = roundToCard(feStats.avg);
    const scoreBe = roundToCard(beStats.avg);
    updates[`rooms/${roomCode}/meta/taskList/items/${activeId}/scoreFe`] =
      scoreFe == null ? (feStats.avg === '-' ? '-' : null) : String(scoreFe);
    updates[`rooms/${roomCode}/meta/taskList/items/${activeId}/scoreBe`] =
      scoreBe == null ? (beStats.avg === '-' ? '-' : null) : String(scoreBe);
  } else {
    const stats = computeStats(voting.filter((p) => p.vote != null).map((p) => ({ vote: p.vote })));
    const rounded = roundToCard(stats.avg);
    updates[`rooms/${roomCode}/meta/taskList/items/${activeId}/score`] =
      rounded == null ? (stats.avg === '-' ? '-' : null) : String(rounded);
  }
  updates[`rooms/${roomCode}/meta/taskList/items/${activeId}/scoredAt`] = Date.now();

  // Find next pending item by order (items with no score fields set).
  const sorted = Object.entries(taskList.items)
    .map(([id, it]) => ({ id, ...(it || {}) }))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const nextPending = sorted.find(
    (it) => it.id !== activeId && it.score == null && it.scoreFe == null && it.scoreBe == null,
  );
  if (nextPending) {
    updates[`rooms/${roomCode}/meta/taskList/activeId`] = nextPending.id;
    updates[`rooms/${roomCode}/meta/task`] = nextPending.title;
  } else {
    updates[`rooms/${roomCode}/meta/taskList/activeId`] = null;
    updates[`rooms/${roomCode}/meta/task`] = '';
  }
  return updates;
}

export function useRoom(roomCode, playerId, playerName, role = 'player', initialTasks = []) {
  const [players, setPlayers] = useState({});
  const [phase, setPhase] = useState('voting');
  const [task, setTask] = useState('');
  const [taskList, setTaskList] = useState(null);
  const [taskSwitchNotice, setTaskSwitchNotice] = useState(null);
  const [splitMode, setSplitMode] = useState(false);
  const [pmQuote, setPmQuote] = useState('');
  const [createdAt, setCreatedAt] = useState(0);
  // Unified synced events: { type, data } or null
  const [syncedEvent, setSyncedEvent] = useState(null);
  // PM Crowning Machine ceremony payload (rooms/{code}/meta/pmRoulette).
  // Single blob, written atomically at ceremony-start, nulled at ceremony-end.
  const [pmRoulette, setPmRoulette] = useState(null);
  const [isLeader, setIsLeader] = useState(false);
  const [connected, setConnected] = useState(false);
  const [leaderChangedAt, setLeaderChangedAt] = useState(0);
  const [roomStartCrowning, setRoomStartCrowning] = useState(null);
  // Sticky "the one-time first-leader coronation already ran" flag.
  // Set by `cleanupPayload` in useRoomStartCrowning once the mini-ceremony
  // completes; read by the trigger effect to suppress a re-fire after a
  // page refresh.
  const [roomStartCrowned, setRoomStartCrowned] = useState(false);
  const [shameTimer, setShameTimer] = useState(null);
  const [roomDeleted, setRoomDeleted] = useState(false);
  const roomLoadedRef = useRef(false);
  const unsubscribesRef = useRef([]);
  // One-shot guard so two near-simultaneous re-renders of the promotion effect
  // don't both try to fire a ceremony transaction.
  const firingRef = useRef(false);
  // Captures the leader's data before their Firebase node disappears so the
  // ceremony payload can include outgoingLeaderLastData.
  const lastKnownLeaderRef = useRef(null);
  // Room cleanup: tracks whether the room was ever populated so we can
  // detect the transition from "has players" to "empty" and delete the room.
  const hadPlayersRef = useRef(false);

  useEffect(() => {
    if (!roomCode || !playerId || !playerName) return;
    if (!isSafeRoomCode(roomCode)) {
      console.error('[useRoom] refusing to mount: room code contains unsafe characters');
      return;
    }

    // Players are keyed by a per-tab session ID (not the display name) so
    // two browsers showing the same name coexist as two separate entries
    // and their votes / disconnects never clobber each other.
    const playerRef = ref(db, `rooms/${roomCode}/players/${playerId}`);
    const metaRef = ref(db, `rooms/${roomCode}/meta`);
    const playersRef = ref(db, `rooms/${roomCode}/players`);

    const setupPlayer = async () => {
      // Race-safe room bootstrap: write meta/createdAt with our timestamp, then
      // re-read it. If another client got there first, our timestamp will be
      // overwritten on read by the earlier one and we gracefully become a joiner
      // instead of a second "creator". We also only write `players/me` — not the
      // whole room — to avoid two concurrent creators clobbering each other's
      // player maps.
      const metaSnap = await get(metaRef);
      const existingMeta = metaSnap.val();

      if (!existingMeta) {
        // Establish meta separately so concurrent joiners can't wipe each
        // other's player nodes. Whichever client's set() lands last wins the
        // meta race — both players still end up in `players/`.
        const seededList = buildInitialTaskList(initialTasks);
        const metaPayload = {
          task: seededList ? seededList.items.t1.title : '',
          phase: 'voting',
          splitMode: false,
          createdAt: serverTimestamp(),
        };
        if (seededList) metaPayload.taskList = seededList;
        await set(metaRef, metaPayload);
      }

      // Determine leadership based on current player map (post-meta-write)
      const playersSnap = await get(playersRef);
      const existingPlayers = playersSnap.val() || {};
      const alreadyInRoom = !!existingPlayers[playerId];
      const hasLeader = Object.values(existingPlayers).some(p => p.isLeader);

      if (!alreadyInRoom) {
        await set(playerRef, {
          name: playerName,
          joinedAt: Date.now(),
          vote: null,
          voteFe: null,
          voteBe: null,
          // First arrival in an empty room becomes leader regardless of role.
          // Otherwise, PM joiners can promote themselves only if there's no
          // existing leader (e.g. after the previous one disconnected).
          isLeader: Object.keys(existingPlayers).length === 0 || (!hasLeader && role === 'pm'),
          role: role,
          disconnected: false,
        });
      } else {
        // Reconnect after refresh / brief network flap. Our previous
        // `onDisconnect` marked us `disconnected: true`; clear it so the
        // filtered roster shows us again. vote / isLeader / voteFe /
        // voteBe are preserved exactly because the record was never
        // wiped — this is the whole point of preserving over removing.
        await update(playerRef, { disconnected: false });
      }

      // Mark disconnection instead of removing the record — preserves
      // vote, voteFe, voteBe, isLeader, and joinedAt through a refresh.
      // setupPlayer above clears the flag on reconnect. Consumers filter
      // disconnected entries out of the visible grid / vote count, but
      // the ceremony-trigger effect intentionally keeps them in scope so
      // a leader's brief disconnect doesn't trigger a new coronation.
      onDisconnect(playerRef).update({ disconnected: true });
      // Connectivity is now driven by the `.info/connected` subscription
      // below, not by a one-shot setConnected(true) at bootstrap. That way
      // a mid-session WebSocket drop actually flips connected back to false
      // and the UI can render a reconnect banner instead of stale state.
    };

    setupPlayer();

    // Firebase exposes `.info/connected` as a system path that mirrors the
    // realtime client's WebSocket state. Subscribing here means every
    // disconnect/reconnect during the session is reflected in `connected`,
    // not just the initial bootstrap.
    const connectedRef = ref(db, '.info/connected');
    const unsubConnected = onValue(connectedRef, (snap) => {
      setConnected(!!snap.val());
    });

    const unsubPlayers = onValue(playersRef, (snap) => {
      const data = snap.val() || {};
      setPlayers(data);
      if (data[playerId]) {
        setIsLeader(data[playerId].isLeader === true);
      }
      const leaderEntry = Object.entries(data).find(([, p]) => p && p.isLeader);
      if (leaderEntry) {
        lastKnownLeaderRef.current = { id: leaderEntry[0], data: leaderEntry[1] };
      }
    });

    const unsubMeta = onValue(metaRef, (snap) => {
      const data = snap.val();
      if (data) {
        setPhase(data.phase || 'voting');
        setTask(data.task || '');
        setTaskList(data.taskList || null);
        setTaskSwitchNotice(data.taskSwitchNotice || null);
        setSplitMode(data.splitMode || false);
        setPmQuote(data.pmQuote || '');
        setSyncedEvent(data.syncedEvent || null);
        setLeaderChangedAt(data.leaderChangedAt || 0);
        setCreatedAt(typeof data.createdAt === 'number' ? data.createdAt : Date.now());
        // Only expose a pmRoulette payload that passes schema+TTL
        // validation. Anything else (half-written, stale, wrong version)
        // is treated as absent so the stage never renders garbage.
        const rawRoulette = data.pmRoulette || null;
        if (rawRoulette && isValidCeremonyPayload(rawRoulette) && !isStalePayload(rawRoulette)) {
          setPmRoulette(rawRoulette);
        } else {
          setPmRoulette(null);
        }
        setRoomStartCrowning(data.roomStartCrowning || null);
        setRoomStartCrowned(data.roomStartCrowned === true);
        setShameTimer(data.shameTimer || null);
        roomLoadedRef.current = true;
      } else {
        setPmRoulette(null);
        setRoomStartCrowning(null);
        setRoomStartCrowned(false);
        setTaskList(null);
        setTaskSwitchNotice(null);
        // Room was populated but is now empty -- all players left.
        if (roomLoadedRef.current) {
          setRoomDeleted(true);
        }
      }
    });

    unsubscribesRef.current = [unsubPlayers, unsubMeta, unsubConnected];

    return () => {
      unsubscribesRef.current.forEach(unsub => unsub());
    };
    // `role` and `initialTasks` are intentionally read from closure on the
    // first-mount path only. Adding them to deps would retrigger setupPlayer
    // on a parent re-render and re-seed the room from scratch — a
    // first-join-only write guarded by `!existingMeta` handles this safely.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode, playerId, playerName]);

  // === PM Crowning Machine: detect leader-gap, fire ceremony =============
  //
  // When the previous leader disconnects, the earliest-joined remaining
  // non-PM candidate writes a `pmRoulette` ceremony payload — it does NOT
  // bare-set isLeader. The ceremony itself (see `useSlotMachine` +
  // `resolvePmRoulettePromotion`) performs the leader-flag flip atomically
  // via a multi-path update at the start of the `cabinetOut` phase.
  //
  // Grace window: the firing decision is wrapped in a 5s setTimeout. If
  // the leader reconnects during that window — or if someone else fires
  // the ceremony first — the effect re-runs (players / pmRoulette are
  // deps), the cleanup cancels our pending timer, and no ceremony starts.
  // This covers the common "leader refreshed their tab" case where their
  // `isLeader` flag briefly disappears while onDisconnect + setupPlayer
  // round-trip through Firebase.
  //
  // No code path here writes `isLeader = true` directly. The only sources
  // of `isLeader = true` are:
  //   (a) `setupPlayer` above for first-joiner into a fresh room, and
  //   (b) `resolvePmRoulettePromotion` below, fired during crownDelivery.
  useEffect(() => {
    if (!roomCode || !playerId || Object.keys(players).length === 0) return undefined;

    // A leader who is marked `disconnected: true` (onDisconnect fired)
    // is treated as absent for the ceremony-trigger purpose. Combined
    // with the CEREMONY_GRACE_MS grace below, this means: leader
    // refreshes → comes back within the grace → timer cancelled, no
    // ceremony. Leader closes the browser for good → after the grace
    // expires the ceremony fires and another player is crowned.
    const hasConnectedLeader = Object.values(players).some(p => p.isLeader && !p.disconnected);
    if (hasConnectedLeader) return undefined;

    // If an active ceremony already exists, do NOT race it.
    const nowCheck = Date.now();
    const hasActiveCeremony = pmRoulette
      && pmRoulette.schemaVersion === SCHEMA_VERSION
      && (pmRoulette.expiresAt || 0) > nowCheck;
    if (hasActiveCeremony) return undefined;

    // Only the earliest-joined candidate writes.
    const sorted = nonPmCandidatesSorted(players);
    if (sorted.length === 0) {
      // PM-only room: no ceremony needed. (Room cleanup when truly empty
      // is handled by the dedicated playerCount watcher effect below.)
      return undefined;
    }
    if (sorted[0][0] !== playerId) return undefined;

    // Guard so rapid re-renders don't double-fire the transaction.
    if (firingRef.current) return undefined;

    // CEREMONY_GRACE_MS is module-scoped (exported) so tests can reuse it
    // in their `waitFor` timeouts instead of hardcoding a magic number.
    const graceTimer = setTimeout(async () => {
      // Double-check conditions at fire time — the DB may have changed
      // while we were waiting for the grace window.
      if (firingRef.current) return;
      firingRef.current = true;

      try {
        // Re-read the live player map straight from Firebase. The React
        // closure captured `players` at grace-timer-start, but during a
        // leader refresh the actual DB state may already show the leader
        // reconnected (disconnected: false) before our local subscription
        // propagates. Without this fresh read, a refreshing leader racing
        // the grace deadline still triggers a ceremony against themselves.
        // Construct the ref here — the one declared in the setup effect is
        // out of scope from this ceremony-trigger effect.
        const livePlayersRef = ref(db, `rooms/${roomCode}/players`);
        const livePlayersSnap = await get(livePlayersRef);
        const livePlayers = livePlayersSnap.val() || {};
        const hasConnectedLeaderLive = Object.values(livePlayers)
          .some((p) => p && p.isLeader && !p.disconnected);
        if (hasConnectedLeaderLive) {
          firingRef.current = false;
          return;
        }

        // Re-read the live syncedEvent; if an important cinematic is
        // currently playing, yield — one scheduled retry at its expiry.
        const seSnap = await get(ref(db, `rooms/${roomCode}/meta/syncedEvent`));
        const live = seSnap.val();
        const nowLocal = Date.now();
        const blockedByEvent = live
          && IMPORTANT_EVENTS.includes(live.type)
          && (live.expiresAt || 0) > nowLocal;
        if (blockedByEvent) {
          const retryIn = Math.max(100, (live.expiresAt || nowLocal) + 50 - nowLocal);
          setTimeout(() => { firingRef.current = false; }, retryIn);
          return;
        }

        // Build the payload from the live Firebase state (not stale React
        // closure) so candidate picking reflects current online players.
        const payload = buildCeremonyPayload({
          players: livePlayers,
          now: nowLocal,
          outgoingLeader: lastKnownLeaderRef.current,
        });
        if (!payload) {
          // Zero candidates — nothing to do.
          firingRef.current = false;
          return;
        }

        const { committed } = await runTransaction(
          ref(db, `rooms/${roomCode}/meta/pmRoulette`),
          (current) => {
            // Another client beat us to it — abort.
            if (current
              && current.schemaVersion === SCHEMA_VERSION
              && (current.expiresAt || 0) > nowLocal) {
              return;
            }
            return payload;
          }
        );

        if (!committed) {
          // Someone else won the race. That's fine — their payload is now
          // live and we'll render it from the subscription.
          firingRef.current = false;
          return;
        }
        // Transaction landed — reset the guard after a short cooldown so
        // subsequent ceremonies can fire in this room. 5s is long enough
        // to cover the Firebase round-trip for clearPmRoulette + leader
        // promotion, but short enough to not block legitimate consecutive
        // ceremonies.
        setTimeout(() => { firingRef.current = false; }, 5000);
      } catch (err) {
        console.error('[useRoom] firePmRoulette failed', err);
        firingRef.current = false;
      }
    }, CEREMONY_GRACE_MS);

    return () => clearTimeout(graceTimer);
  }, [players, roomCode, playerId, pmRoulette]);

  // Reset the firing guard when a ceremony clears AND the leader has been
  // promoted. Without the hasLeader check, the guard resets too early:
  // clearPmRoulette (which nulls pmRoulette) can arrive before
  // resolvePmRoulettePromotion (which sets isLeader=true) propagates back
  // through Firebase, causing the trigger effect to see no leader + guard
  // false and fire a duplicate ceremony.
  useEffect(() => {
    if (!pmRoulette) {
      // Only reset the guard when a CONNECTED leader is present —
      // mirrors the disconnected-aware check in the trigger effect so we
      // don't race the grace window.
      const hasConnectedLeader = Object.values(players).some(p => p.isLeader && !p.disconnected);
      if (hasConnectedLeader) {
        firingRef.current = false;
      }
    }
  }, [pmRoulette, players]);

  // === Room cleanup: delete from Firebase when all players leave ===========
  //
  // The ceremony trigger effect above early-returns when players is empty
  // (line 214), so it can never reach room deletion code. This separate
  // effect watches for the transition from "had players" to "empty" and
  // performs the cleanup as a dedicated concern.
  const playerCount = Object.keys(players).length;
  useEffect(() => {
    if (playerCount > 0) {
      hadPlayersRef.current = true;
    } else if (hadPlayersRef.current && playerCount === 0 && roomCode) {
      // Room was populated but is now empty — clean up.
      hadPlayersRef.current = false;
      remove(ref(db, `rooms/${roomCode}`)).catch((err) =>
        console.error('[useRoom] room cleanup failed', err)
      );
    }
  }, [playerCount, roomCode]);

  const castVote = useCallback((value) => {
    if (!roomCode || !playerId || phase !== 'voting') return;
    safeWrite(set(ref(db, `rooms/${roomCode}/players/${playerId}/vote`), value));
  }, [roomCode, playerId, phase]);

  const castVoteFe = useCallback((value) => {
    if (!roomCode || !playerId || phase !== 'voting') return;
    safeWrite(set(ref(db, `rooms/${roomCode}/players/${playerId}/voteFe`), value));
  }, [roomCode, playerId, phase]);

  const castVoteBe = useCallback((value) => {
    if (!roomCode || !playerId || phase !== 'voting') return;
    safeWrite(set(ref(db, `rooms/${roomCode}/players/${playerId}/voteBe`), value));
  }, [roomCode, playerId, phase]);

  const revealCards = useCallback(async () => {
    if (!roomCode || !isLeader) return;
    await set(ref(db, `rooms/${roomCode}/meta/phase`), 'revealed');
  }, [roomCode, isLeader]);

  const newRound = useCallback(async () => {
    if (!roomCode || !isLeader) return;
    // Before we blow away the votes, read the live score-relevant state
    // (taskList + players + splitMode + phase) from Firebase. Reading live
    // instead of React-closure state guarantees we score whatever was
    // actually on screen at reveal time, even if the React subscription
    // hasn't propagated every intermediate value yet.
    const [metaSnap, playersSnap] = await Promise.all([
      get(ref(db, `rooms/${roomCode}/meta`)),
      get(ref(db, `rooms/${roomCode}/players`)),
    ]);
    const meta = metaSnap.val() || {};
    const livePlayers = playersSnap.val() || {};
    const liveTaskList = meta.taskList || null;
    const liveSplit = !!meta.splitMode;
    const livePhase = meta.phase || 'voting';

    const updates = {
      [`rooms/${roomCode}/meta/splitMode`]: false,
      [`rooms/${roomCode}/meta/phase`]: 'voting',
    };
    Object.keys(livePlayers).forEach((id) => {
      updates[`rooms/${roomCode}/players/${id}/vote`] = null;
      updates[`rooms/${roomCode}/players/${id}/voteFe`] = null;
      updates[`rooms/${roomCode}/players/${id}/voteBe`] = null;
    });
    // Only persist a score when this newRound follows a revealed round
    // AND a task is active. If the leader clicks New Round from the
    // voting phase (rare, e.g. to abandon without reveal), we just reset
    // votes and leave the task's score null — which is what the user
    // would expect.
    if (livePhase === 'revealed' && liveTaskList?.activeId) {
      const taskUpdates = computeTaskListUpdates({
        taskList: liveTaskList,
        players: livePlayers,
        splitMode: liveSplit,
        roomCode,
      });
      Object.assign(updates, taskUpdates);
    }
    await update(ref(db), updates);
  }, [roomCode, isLeader]);

  const updateTask = useCallback((newTask) => {
    if (!roomCode || !isLeader) return;
    safeWrite(set(ref(db, `rooms/${roomCode}/meta/task`), newTask));
  }, [roomCode, isLeader]);

  const setPmQuoteFirebase = useCallback((q) => {
    if (!roomCode) return;
    safeWrite(set(ref(db, `rooms/${roomCode}/meta/pmQuote`), q));
  }, [roomCode]);

  // Fire a synced event visible to all players.
  // Important events (train, chicken, dbbPipeline) are mutually exclusive:
  // once one is active, NOTHING else can fire over it — not even another
  // important event. That guarantees Richard's train and Tomáš's DBB
  // pipeline never play simultaneously.
  //
  // Additionally, an active PM Crowning Machine ceremony blocks ALL synced
  // events (important or minor) from firing — the ceremony is the most
  // important cinematic in the app and nothing may visually overlap it.
  //
  // Implemented with `runTransaction` so the mutex check happens atomically
  // against Firebase's live value — the previous `useCallback([syncedEvent])`
  // version captured stale state between rapid calls and could let a second
  // important event slip through within a single render.
  const fireSyncedEvent = useCallback(async (eventData, durationMs = 4000) => {
    if (!roomCode) return false;
    const now = Date.now();
    // Refuse if a PM Crowning Machine ceremony is currently active.
    try {
      const rouletteSnap = await get(ref(db, `rooms/${roomCode}/meta/pmRoulette`));
      const live = rouletteSnap.val();
      if (live
        && live.schemaVersion === SCHEMA_VERSION
        && (live.expiresAt || 0) > now) {
        return false;
      }
    } catch {
      // If we can't read pmRoulette for some reason, proceed — failing
      // open keeps the existing entrance events working.
    }
    const payload = { ...eventData, startedAt: now, expiresAt: now + durationMs };
    const { committed } = await runTransaction(
      ref(db, `rooms/${roomCode}/meta/syncedEvent`),
      (current) => {
        // Block if an important event is still actively playing.
        if (current && IMPORTANT_EVENTS.includes(current.type) && (current.expiresAt || 0) > now) {
          return; // abort transaction → committed === false
        }
        return payload;
      }
    );
    if (!committed) return false;
    // Best-effort cleanup after the event's duration elapses. Any client can
    // run this — we only null the slot if it's still OUR event (matched by
    // `startedAt`), so a later event can't be accidentally wiped.
    setTimeout(() => {
      get(ref(db, `rooms/${roomCode}/meta/syncedEvent`)).then(snap => {
        const current = snap.val();
        if (current && current.startedAt === payload.startedAt) {
          set(ref(db, `rooms/${roomCode}/meta/syncedEvent`), null);
        }
      });
    }, durationMs);
    return true;
  }, [roomCode]);

  // === PM Crowning Machine helpers =======================================

  // Multi-path atomic promotion: clears every player's `isLeader` flag and
  // sets the winner's in ONE update(). Stamps leaderChangedAt and clears
  // any stuck PM quote. This is the ONLY code path outside the first-joiner
  // case that writes `isLeader = true`.
  const resolvePmRoulettePromotion = useCallback(async (ceremony) => {
    if (!roomCode || !ceremony || !ceremony.winnerId) return { status: 'bad-args' };
    try {
      // Verify the winner still exists. If not, the ceremony completes
      // visually and a second ceremony will fire when the payload is nulled.
      const winnerSnap = await get(ref(db, `rooms/${roomCode}/players/${ceremony.winnerId}`));
      const winnerData = winnerSnap.val();
      if (!winnerData) return { status: 'winner-gone' };

      // Pull the live players map so the update paths cover every slot.
      const playersSnap = await get(ref(db, `rooms/${roomCode}/players`));
      const livePlayers = playersSnap.val() || {};

      const updates = {};
      for (const id of Object.keys(livePlayers)) {
        updates[`rooms/${roomCode}/players/${id}/isLeader`] = (id === ceremony.winnerId);
      }
      updates[`rooms/${roomCode}/meta/leaderChangedAt`] = Date.now();
      updates[`rooms/${roomCode}/meta/pmQuote`] = '';
      await update(ref(db), updates);
      return { status: 'ok' };
    } catch (err) {
      console.error('[useRoom] resolvePmRoulettePromotion failed', err);
      return { status: 'error', error: err };
    }
  }, [roomCode]);

  // Null the ceremony payload if the ceremonyId still matches.
  // Never stomps a newer ceremony.
  const clearPmRoulette = useCallback(async (ceremony) => {
    if (!roomCode) return;
    try {
      const snap = await get(ref(db, `rooms/${roomCode}/meta/pmRoulette`));
      const current = snap.val();
      if (!current) return;
      if (!ceremony || current.ceremonyId === ceremony.ceremonyId) {
        await set(ref(db, `rooms/${roomCode}/meta/pmRoulette`), null);
      }
    } catch (err) {
      console.error('[useRoom] clearPmRoulette failed', err);
    }
  }, [roomCode]);

  // Safety-net promotion timer: ensures the leader flag eventually flips
  // even if no client is rendering the SlotMachineStage (e.g. in a hook-only
  // test environment, or a PM-role-only tab with the overlay disabled).
  // Fires at `startedAt + cabinetOutStart` for the standard timing
  // (~7900ms after payload write). When the SlotMachineStage IS mounted
  // it races this and typically beats it by 0-16ms, but both call
  // resolvePmRoulettePromotion idempotently — worst case we run a redundant
  // multi-path update against an already-promoted state.
  const ceremonyId = pmRoulette?.ceremonyId;
  const ceremonyStartedAt = pmRoulette?.startedAt;
  useEffect(() => {
    if (!roomCode || !ceremonyId) return;
    // Safety-net: fires well after the full ceremony (21300ms) + 3000ms grace.
    // Previous value of 12900ms was for the shorter ceremony.
    const SAFETY_NET_DELAY = 24300;
    const elapsed = Date.now() - (ceremonyStartedAt || Date.now());
    const delay = Math.max(0, SAFETY_NET_DELAY - elapsed);
    const snapshot = pmRoulette;
    const timer = setTimeout(() => {
      get(ref(db, `rooms/${roomCode}/players`)).then((snap) => {
        const live = snap.val() || {};
        const hasLeader = Object.values(live).some((p) => p && p.isLeader);
        if (!hasLeader) {
          resolvePmRoulettePromotion(snapshot).then(() => {
            clearPmRoulette(snapshot);
          });
        } else {
          clearPmRoulette(snapshot);
        }
      }).catch(() => { /* ignore */ });
    }, delay);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode, ceremonyId, ceremonyStartedAt]);

  const setShameTimerFirebase = useCallback((value) => {
    if (!roomCode) return;
    safeWrite(set(ref(db, `rooms/${roomCode}/meta/shameTimer`), value));
  }, [roomCode]);

  // OKTA easter egg now flows through the unified syncedEvent channel —
  // OverlayStage picks it up via the entranceEvents registry. Returns the
  // promise so tests can await the dispatch.
  const triggerOkta = useCallback(() => {
    if (!roomCode) return Promise.resolve(false);
    return fireSyncedEvent({ type: 'okta' }, 4500);
  }, [roomCode, fireSyncedEvent]);

  // === Grooming backlog helpers (leader-only) ============================

  // Set which backlog item is currently being groomed. Mirrors the new
  // item's title into `meta/task` so the legacy TaskBar display path and
  // any downstream consumers of `task` keep working.
  //
  // If the leader switches to a different item while the current one has
  // no score yet (cards never revealed / round never closed), also write
  // `meta/taskSwitchNotice` — every client reads that and flashes a
  // short-lived toast so players aren't left wondering why their vote
  // context silently changed under them.
  const setActiveTask = useCallback(async (id) => {
    if (!roomCode || !isLeader || !id) return;
    // Read list + players in parallel. We need the list for the target
    // item + switch-notice decision, and the player map to zero every
    // player's vote columns when the active task actually changes.
    const [listSnap, playersSnap] = await Promise.all([
      get(ref(db, `rooms/${roomCode}/meta/taskList`)),
      get(ref(db, `rooms/${roomCode}/players`)),
    ]);
    const list = listSnap.val() || {};
    const items = list.items || {};
    const item = items[id];
    if (!item) return; // unknown id — no-op

    const currentActiveId = list.activeId || null;
    const currentItem = currentActiveId ? items[currentActiveId] : null;
    const currentScored = !!currentItem && (
      currentItem.score != null
      || currentItem.scoreFe != null
      || currentItem.scoreBe != null
    );
    const isDifferent = currentActiveId && currentActiveId !== id;

    const updates = {
      [`rooms/${roomCode}/meta/taskList/activeId`]: id,
      [`rooms/${roomCode}/meta/task`]: item.title || '',
    };

    // When the active task actually changes, wipe every player's vote
    // columns and bounce phase back to 'voting'. Without this, players
    // walking into a new task would see their last task's cards still
    // selected — which both looks broken and could accidentally seed
    // the next score via a stale "Reveal" click. Also clear the shame
    // timer since the previous holdout's clock no longer makes sense
    // once everyone is back to zero votes.
    if (isDifferent) {
      const livePlayers = playersSnap.val() || {};
      Object.keys(livePlayers).forEach((pid) => {
        updates[`rooms/${roomCode}/players/${pid}/vote`] = null;
        updates[`rooms/${roomCode}/players/${pid}/voteFe`] = null;
        updates[`rooms/${roomCode}/players/${pid}/voteBe`] = null;
      });
      updates[`rooms/${roomCode}/meta/phase`] = 'voting';
      updates[`rooms/${roomCode}/meta/shameTimer`] = null;
    }

    // "Leader bailed on an unfinished task" — surface a notice. The
    // TTL (4.5s) is slightly longer than the display duration so a
    // late-arriving client subscription still sees it.
    if (currentItem && isDifferent && !currentScored) {
      const now = Date.now();
      const notice = {
        prevTitle: currentItem.title || '',
        nextTitle: item.title || '',
        startedAt: now,
        expiresAt: now + 4500,
      };
      updates[`rooms/${roomCode}/meta/taskSwitchNotice`] = notice;
      // Best-effort cleanup so the key doesn't linger in Firebase. Match
      // by startedAt so a newer notice can't be wiped accidentally.
      setTimeout(() => {
        get(ref(db, `rooms/${roomCode}/meta/taskSwitchNotice`)).then((snap) => {
          const current = snap.val();
          if (current && current.startedAt === notice.startedAt) {
            set(ref(db, `rooms/${roomCode}/meta/taskSwitchNotice`), null);
          }
        }).catch(() => { /* ignore */ });
      }, 4500);
    }

    await update(ref(db), updates);
  }, [roomCode, isLeader]);

  // Replace the whole items map with a new set of rows. Each incoming row
  // may carry an `id` to preserve its existing score; rows without an id
  // get a freshly-minted one. `activeId` is kept if it still exists in
  // the new list, otherwise it falls to the first pending item (or null
  // if everything is already scored).
  const upsertTasks = useCallback(async (rows) => {
    if (!roomCode || !isLeader || !Array.isArray(rows)) return;
    const existingSnap = await get(ref(db, `rooms/${roomCode}/meta/taskList`));
    const existing = existingSnap.val();
    const existingItems = existing?.items || {};
    const currentActiveId = existing?.activeId || null;

    // Figure out the next free id (`t${N+1}` where N is the highest
    // existing numeric suffix). Works even if some ids were removed.
    let nextN = 0;
    Object.keys(existingItems).forEach((id) => {
      const m = /^t(\d+)$/.exec(id);
      if (m) nextN = Math.max(nextN, parseInt(m[1], 10));
    });

    const nextItems = {};
    rows.forEach((row, i) => {
      if (!row || typeof row !== 'object') return;
      const title = typeof row.title === 'string' ? row.title.trim() : '';
      if (!title) return;
      const url = normalizeUrl(row.url);
      let id = row.id && existingItems[row.id] ? row.id : null;
      if (!id) { nextN += 1; id = `t${nextN}`; }
      const prior = existingItems[id] || {};
      nextItems[id] = {
        title,
        url,
        order: i,
        score: prior.score ?? null,
        scoreFe: prior.scoreFe ?? null,
        scoreBe: prior.scoreBe ?? null,
        scoredAt: prior.scoredAt ?? null,
      };
    });

    // Pick the activeId: keep the current one if it survived; otherwise
    // jump to the first pending item by order.
    let nextActiveId = currentActiveId && nextItems[currentActiveId] ? currentActiveId : null;
    if (!nextActiveId) {
      const sorted = Object.entries(nextItems)
        .map(([id, it]) => ({ id, ...it }))
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      const firstPending = sorted.find(
        (it) => it.score == null && it.scoreFe == null && it.scoreBe == null,
      );
      nextActiveId = firstPending ? firstPending.id : null;
    }

    const updates = {
      [`rooms/${roomCode}/meta/taskList`]: { activeId: nextActiveId, items: nextItems },
    };
    // Keep meta/task mirrored to the active item's title (or empty).
    if (nextActiveId && nextItems[nextActiveId]) {
      updates[`rooms/${roomCode}/meta/task`] = nextItems[nextActiveId].title;
    } else {
      updates[`rooms/${roomCode}/meta/task`] = '';
    }
    await update(ref(db), updates);
  }, [roomCode, isLeader]);

  // Toggle the FE/BE split. When turning ON we also fire the
  // SPECIAL ROUND splash via syncedEvent so every client sees it.
  const toggleSplit = useCallback(() => {
    if (!roomCode || !isLeader) return;
    const newSplit = !splitMode;
    safeWrite(set(ref(db, `rooms/${roomCode}/meta/splitMode`), newSplit));
    if (newSplit) {
      fireSyncedEvent({ type: 'specialRound' }, 2500);
    }
  }, [roomCode, isLeader, splitMode, fireSyncedEvent]);

  return {
    players,
    phase,
    task,
    taskList,
    taskSwitchNotice,
    setActiveTask,
    upsertTasks,
    splitMode,
    pmQuote,
    setPmQuote: setPmQuoteFirebase,
    triggerOkta,
    syncedEvent,
    fireSyncedEvent,
    pmRoulette,
    resolvePmRoulettePromotion,
    clearPmRoulette,
    roomStartCrowning,
    roomStartCrowned,
    shameTimer,
    setShameTimer: setShameTimerFirebase,
    roomDeleted,
    isLeader,
    connected,
    leaderChangedAt,
    createdAt,
    castVote,
    castVoteFe,
    castVoteBe,
    toggleSplit,
    revealCards,
    newRound,
    updateTask,
  };
}

export { generateRoomCode };
