import { useState, useEffect, useCallback, useRef } from 'react';
import { db, ref, set, get, update, onValue, onDisconnect, serverTimestamp } from '../firebase';

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function useRoom(roomCode, playerName, role = 'player') {
  const [players, setPlayers] = useState({});
  const [phase, setPhase] = useState('voting');
  const [task, setTask] = useState('');
  const [splitMode, setSplitMode] = useState(false);
  const [isLeader, setIsLeader] = useState(false);
  const [connected, setConnected] = useState(false);
  const unsubscribesRef = useRef([]);

  useEffect(() => {
    if (!roomCode || !playerName) return;

    const roomRef = ref(db, `rooms/${roomCode}`);
    const playerRef = ref(db, `rooms/${roomCode}/players/${playerName}`);
    const metaRef = ref(db, `rooms/${roomCode}/meta`);
    const playersRef = ref(db, `rooms/${roomCode}/players`);

    const setupPlayer = async () => {
      const roomSnap = await get(roomRef);
      const roomExists = roomSnap.exists();

      if (!roomExists) {
        await set(roomRef, {
          meta: {
            task: '',
            phase: 'voting',
            splitMode: false,
            createdAt: Date.now(),
          },
          players: {
            [playerName]: {
              name: playerName,
              joinedAt: Date.now(),
              vote: null,
              voteFe: null,
              voteBe: null,
              isLeader: true, // creator is always leader
              role: role,
            }
          }
        });
      } else {
        const playerSnap = await get(playerRef);
        if (!playerSnap.exists()) {
          const playersSnap = await get(playersRef);
          const existingPlayers = playersSnap.val() || {};
          const hasLeader = Object.values(existingPlayers).some(p => p.isLeader);

          await set(playerRef, {
            name: playerName,
            joinedAt: Date.now(),
            vote: null,
            voteFe: null,
            voteBe: null,
            isLeader: !hasLeader && role === 'pm',
            role: role,
          });
        } else {
          await update(playerRef, { name: playerName });
        }
      }

      onDisconnect(playerRef).remove();
      setConnected(true);
    };

    setupPlayer();

    const unsubPlayers = onValue(playersRef, (snap) => {
      const data = snap.val() || {};
      setPlayers(data);
      if (data[playerName]) {
        setIsLeader(data[playerName].isLeader === true);
      }
    });

    const unsubMeta = onValue(metaRef, (snap) => {
      const data = snap.val();
      if (data) {
        setPhase(data.phase || 'voting');
        setTask(data.task || '');
        setSplitMode(data.splitMode || false);
      }
    });

    unsubscribesRef.current = [unsubPlayers, unsubMeta];

    return () => {
      unsubscribesRef.current.forEach(unsub => unsub());
      set(playerRef, null);
    };
  }, [roomCode, playerName]);

  // Leader promotion
  useEffect(() => {
    if (!roomCode || !playerName || Object.keys(players).length === 0) return;
    const hasLeader = Object.values(players).some(p => p.isLeader);
    if (!hasLeader) {
      const sorted = Object.entries(players).sort((a, b) => a[1].joinedAt - b[1].joinedAt);
      if (sorted.length > 0 && sorted[0][0] === playerName) {
        set(ref(db, `rooms/${roomCode}/players/${playerName}/isLeader`), true);
      }
    }
  }, [players, roomCode, playerName]);

  const castVote = useCallback((value) => {
    if (!roomCode || !playerName || phase !== 'voting') return;
    set(ref(db, `rooms/${roomCode}/players/${playerName}/vote`), value);
  }, [roomCode, playerName, phase]);

  const castVoteFe = useCallback((value) => {
    if (!roomCode || !playerName || phase !== 'voting') return;
    set(ref(db, `rooms/${roomCode}/players/${playerName}/voteFe`), value);
  }, [roomCode, playerName, phase]);

  const castVoteBe = useCallback((value) => {
    if (!roomCode || !playerName || phase !== 'voting') return;
    set(ref(db, `rooms/${roomCode}/players/${playerName}/voteBe`), value);
  }, [roomCode, playerName, phase]);

  const toggleSplit = useCallback(() => {
    if (!roomCode || !isLeader) return;
    set(ref(db, `rooms/${roomCode}/meta/splitMode`), !splitMode);
  }, [roomCode, isLeader, splitMode]);

  const revealCards = useCallback(async () => {
    if (!roomCode || !isLeader) return;
    await set(ref(db, `rooms/${roomCode}/meta/phase`), 'revealed');
  }, [roomCode, isLeader]);

  const newRound = useCallback(async () => {
    if (!roomCode || !isLeader) return;
    await set(ref(db, `rooms/${roomCode}/meta/phase`), 'voting');
    const playersSnap = await get(ref(db, `rooms/${roomCode}/players`));
    const data = playersSnap.val() || {};
    const updates = {};
    Object.keys(data).forEach(name => {
      updates[`rooms/${roomCode}/players/${name}/vote`] = null;
      updates[`rooms/${roomCode}/players/${name}/voteFe`] = null;
      updates[`rooms/${roomCode}/players/${name}/voteBe`] = null;
    });
    await update(ref(db), updates);
  }, [roomCode, isLeader]);

  const updateTask = useCallback((newTask) => {
    if (!roomCode || !isLeader) return;
    set(ref(db, `rooms/${roomCode}/meta/task`), newTask);
  }, [roomCode, isLeader]);

  return {
    players,
    phase,
    task,
    splitMode,
    isLeader,
    connected,
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
