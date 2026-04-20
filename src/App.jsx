import { useState, useEffect } from 'react';
import NamePrompt from './components/NamePrompt';
import Landing from './components/Landing';
import Room from './components/Room';
import FigureGallery from './components/FigureGallery';
import ErrorBoundary from './components/ErrorBoundary';

// Room codes are strictly 6 uppercase alphanumerics (see generateRoomCode).
// We validate here to prevent a crafted `?room=FOO/bar/..` from being
// concatenated into Firebase path templates — Firebase treats `/` as a path
// separator, so without this guard a URL param could inject arbitrary path
// segments into every write performed by useRoom.
const ROOM_CODE_RE = /^[A-Z0-9]{6}$/;

function getRoomFromURL() {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('room')?.toUpperCase() || null;
  return raw && ROOM_CODE_RE.test(raw) ? raw : null;
}

function getGalleryMode() {
  return new URLSearchParams(window.location.search).has('gallery');
}

// Per-tab stable player identity. Two browser tabs with the same display
// name must NOT collide inside a room — so we key each Firebase player
// entry on an ID stored in sessionStorage (fresh per tab, preserved across
// refreshes). localStorage would share the ID across tabs and reintroduce
// the duplicate-name bug this was built to fix.
function getOrCreatePlayerId() {
  try {
    const existing = sessionStorage.getItem('poker-player-id');
    if (existing) return existing;
    const id = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
      ? crypto.randomUUID()
      : 'p_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    sessionStorage.setItem('poker-player-id', id);
    return id;
  } catch {
    // sessionStorage unavailable (e.g. incognito with storage disabled).
    // Fall back to an in-memory ID for this tab — still gives duplicate
    // names independent slots within a single page lifecycle.
    return 'p_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }
}

export default function App() {
  const [playerName, setPlayerName] = useState(
    () => localStorage.getItem('poker-player-name') || null
  );
  const [playerId] = useState(getOrCreatePlayerId);
  const [roomCode, setRoomCode] = useState(() => getRoomFromURL());
  const [role, setRole] = useState(() => localStorage.getItem('poker-role') || 'player');
  // Initial grooming backlog seeded by the Landing Manager flow. Empty
  // for joiners and for Manager sessions where the user hit Skip. Read
  // once by useRoom during the first-join bootstrap (see `setupPlayer`
  // there) and then ignored — the live source of truth is Firebase.
  const [initialTasks, setInitialTasks] = useState([]);

  const handleSetName = (name) => {
    setPlayerName(name);
  };

  const handleJoinRoom = (code, selectedRole, tasksForSeed = []) => {
    if (selectedRole) {
      setRole(selectedRole);
      localStorage.setItem('poker-role', selectedRole);
    }
    setInitialTasks(Array.isArray(tasksForSeed) ? tasksForSeed : []);
    setRoomCode(code);
    const url = new URL(window.location);
    url.searchParams.set('room', code);
    window.history.pushState({}, '', url);
  };

  // Handle browser back/forward
  useEffect(() => {
    const handlePop = () => {
      setRoomCode(getRoomFromURL());
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  let content;
  if (getGalleryMode()) {
    content = <FigureGallery />;
  } else if (!playerName) {
    content = <NamePrompt onSubmit={handleSetName} />;
  } else if (!roomCode) {
    content = <Landing playerName={playerName} onJoinRoom={handleJoinRoom} />;
  } else {
    content = (
      <Room
        roomCode={roomCode}
        playerId={playerId}
        playerName={playerName}
        role={role}
        initialTasks={initialTasks}
      />
    );
  }

  return <ErrorBoundary>{content}</ErrorBoundary>;
}
