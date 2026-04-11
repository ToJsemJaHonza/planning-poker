import { useState, useEffect, useCallback, useRef } from 'react';
import { db, ref, set, get, update, onValue, onDisconnect, runTransaction, serverTimestamp } from '../firebase';

// Important events are mutually exclusive cinematics — once one is playing
// in a room, nothing (not even another important event) can overwrite it
// until its TTL expires.
const IMPORTANT_EVENTS = ['train', 'chicken', 'dbbPipeline'];

// Defense-in-depth: reject any room code containing characters that would
// change the Firebase path shape. Firebase RTDB treats `/` as a path
// separator, and `. # $ [ ]` are disallowed key characters — if any of
// those slip into a code they could let a crafted URL param inject extra
// path segments into every write. generateRoomCode always produces
// A–Z/2–9 strings, so this check is a no-op for the legitimate flow.
// Callers (App.getRoomFromURL, Landing.handleJoin) additionally enforce
// the full 6-char shape before getting here.
const ROOM_CODE_INVALID_RE = /[./#$\[\]]/;
const isSafeRoomCode = (code) =>
  typeof code === 'string' && code.length > 0 && !ROOM_CODE_INVALID_RE.test(code);

// Fire-and-forget write helper: log errors to the console so a dropped
// network write doesn't vanish silently (P9).
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

export function useRoom(roomCode, playerId, playerName, role = 'player') {
  const [players, setPlayers] = useState({});
  const [phase, setPhase] = useState('voting');
  const [task, setTask] = useState('');
  const [splitMode, setSplitMode] = useState(false);
  const [specialRound, setSpecialRound] = useState(false);
  const [pmQuote, setPmQuote] = useState('');
  const [oktaEvent, setOktaEvent] = useState(false);
  const [createdAt, setCreatedAt] = useState(0);
  // Unified synced events: { type, data } or null
  const [syncedEvent, setSyncedEvent] = useState(null);
  const [isLeader, setIsLeader] = useState(false);
  const [connected, setConnected] = useState(false);
  const [leaderChangedAt, setLeaderChangedAt] = useState(0);
  const unsubscribesRef = useRef([]);

  useEffect(() => {
    if (!roomCode || !playerId || !playerName) return;
    if (!isSafeRoomCode(roomCode)) {
      console.error('[useRoom] refusing to mount: room code contains unsafe characters');
      return;
    }

    const roomRef = ref(db, `rooms/${roomCode}`);
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
        await set(metaRef, {
          task: '',
          phase: 'voting',
          splitMode: false,
          createdAt: serverTimestamp(),
        });
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
        });
      } else {
        // Same session re-joining their own slot (e.g. Strict Mode double-mount
        // in dev). With the cleanup no longer scrubbing our node, there's
        // nothing to restore — our player entry is still intact as-is.
      }

      onDisconnect(playerRef).remove();
      setConnected(true);
    };

    setupPlayer();

    const unsubPlayers = onValue(playersRef, (snap) => {
      const data = snap.val() || {};
      setPlayers(data);
      if (data[playerId]) {
        setIsLeader(data[playerId].isLeader === true);
      }
    });

    const unsubMeta = onValue(metaRef, (snap) => {
      const data = snap.val();
      if (data) {
        setPhase(data.phase || 'voting');
        setTask(data.task || '');
        setSplitMode(data.splitMode || false);
        setSpecialRound(data.specialRound || false);
        setPmQuote(data.pmQuote || '');
        setOktaEvent(data.oktaEvent || false);
        setSyncedEvent(data.syncedEvent || null);
        setLeaderChangedAt(data.leaderChangedAt || 0);
        setCreatedAt(typeof data.createdAt === 'number' ? data.createdAt : Date.now());
      }
    });

    unsubscribesRef.current = [unsubPlayers, unsubMeta];

    return () => {
      unsubscribesRef.current.forEach(unsub => unsub());
    };
  }, [roomCode, playerId, playerName]);

  // Leader promotion — when the previous leader disconnects (or none exists),
  // the earliest-joined remaining player promotes themselves and scrubs any
  // stuck flags the dead leader left behind.
  //
  // `syncedEvent` is read LIVE from Firebase (not React state) so the age
  // guard below is never fooled by a stale closure. This is critical: on
  // Strict Mode / rapid re-renders, React state can briefly show an older
  // value while Firebase already has the new one.
  useEffect(() => {
    if (!roomCode || !playerId || Object.keys(players).length === 0) return;
    const hasLeader = Object.values(players).some(p => p.isLeader);
    if (hasLeader) return;
    const sorted = Object.entries(players).sort((a, b) => a[1].joinedAt - b[1].joinedAt);
    if (sorted.length === 0 || sorted[0][0] !== playerId) return;

    (async () => {
      // Self-promote first so the takeover is visible ASAP
      await set(ref(db, `rooms/${roomCode}/players/${playerId}/isLeader`), true);

      // Read the LIVE event. If it's fresh (<15s old) it's almost certainly
      // the new leader's own event — don't stomp on it.
      const liveSnap = await get(ref(db, `rooms/${roomCode}/meta/syncedEvent`));
      const currentEvent = liveSnap.val();
      const now = Date.now();
      const MAX_EVENT_AGE_MS = 15_000;

      const wipe = {
        specialRound: false,
        oktaEvent: false,
        pmQuote: '',
        leaderChangedAt: now,
      };
      if (!currentEvent || !currentEvent.startedAt || (now - currentEvent.startedAt) > MAX_EVENT_AGE_MS) {
        wipe.syncedEvent = null;
      }
      update(ref(db, `rooms/${roomCode}/meta`), wipe);
    })();
  }, [players, roomCode, playerId]);

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

  const toggleSplit = useCallback(() => {
    if (!roomCode || !isLeader) return;
    const newSplit = !splitMode;
    safeWrite(set(ref(db, `rooms/${roomCode}/meta/splitMode`), newSplit));
    if (newSplit) {
      // Trigger special round animation for everyone
      safeWrite(set(ref(db, `rooms/${roomCode}/meta/specialRound`), true));
      setTimeout(() => {
        safeWrite(set(ref(db, `rooms/${roomCode}/meta/specialRound`), false));
      }, 2500);
    }
  }, [roomCode, isLeader, splitMode]);

  const revealCards = useCallback(async () => {
    if (!roomCode || !isLeader) return;
    await set(ref(db, `rooms/${roomCode}/meta/phase`), 'revealed');
  }, [roomCode, isLeader]);

  const newRound = useCallback(async () => {
    if (!roomCode || !isLeader) return;
    // Reset split mode back to normal for next round
    await set(ref(db, `rooms/${roomCode}/meta/splitMode`), false);
    await set(ref(db, `rooms/${roomCode}/meta/phase`), 'voting');
    const playersSnap = await get(ref(db, `rooms/${roomCode}/players`));
    const data = playersSnap.val() || {};
    const updates = {};
    Object.keys(data).forEach(id => {
      updates[`rooms/${roomCode}/players/${id}/vote`] = null;
      updates[`rooms/${roomCode}/players/${id}/voteFe`] = null;
      updates[`rooms/${roomCode}/players/${id}/voteBe`] = null;
    });
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
  // Implemented with `runTransaction` so the mutex check happens atomically
  // against Firebase's live value — the previous `useCallback([syncedEvent])`
  // version captured stale state between rapid calls and could let a second
  // important event slip through within a single render.
  const fireSyncedEvent = useCallback(async (eventData, durationMs = 4000) => {
    if (!roomCode) return false;
    const now = Date.now();
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

  const triggerOkta = useCallback(() => {
    if (!roomCode) return;
    safeWrite(set(ref(db, `rooms/${roomCode}/meta/oktaEvent`), true));
    setTimeout(() => safeWrite(set(ref(db, `rooms/${roomCode}/meta/oktaEvent`), false)), 4500);
  }, [roomCode]);

  return {
    players,
    phase,
    task,
    splitMode,
    specialRound,
    pmQuote,
    setPmQuote: setPmQuoteFirebase,
    oktaEvent,
    triggerOkta,
    syncedEvent,
    fireSyncedEvent,
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
