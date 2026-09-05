import { useState, useEffect } from 'react';
import NamePrompt from './components/NamePrompt';
import Landing from './components/Landing';
import Room from './components/Room';
import FigureGallery from './components/FigureGallery';
import ErrorBoundary from './components/ErrorBoundary';
import { readPreference } from './engine/storage';
import { getSessionIdentity } from './sessionIdentity';

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

// Connection IDs are unique; the browser identity links duplicate tabs.
export default function App() {
  const [playerName, setPlayerName] = useState(
    () => readPreference('poker-player-name')
  );
  const [sessionIdentity] = useState(getSessionIdentity);
  const { playerId } = sessionIdentity;
  const [roomCode, setRoomCode] = useState(() => getRoomFromURL());
  // Invitations always join as players. On refresh, Room restores the role
  // from this session's roster entry instead of another room's preference.
  const [role, setRole] = useState('player');
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
      setRole('player');
      setInitialTasks([]);
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
        key={roomCode}
        roomCode={roomCode}
        playerId={playerId}
        playerName={playerName}
        role={role}
        initialTasks={initialTasks}
        sessionIdentity={sessionIdentity}
      />
    );
  }

  return <ErrorBoundary>{content}</ErrorBoundary>;
}
