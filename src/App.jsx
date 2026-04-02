import { useState, useEffect } from 'react';
import NamePrompt from './components/NamePrompt';
import Landing from './components/Landing';
import Room from './components/Room';
import FigureGallery from './components/FigureGallery';

function getRoomFromURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get('room')?.toUpperCase() || null;
}

function getGalleryMode() {
  return new URLSearchParams(window.location.search).has('gallery');
}

export default function App() {
  const [playerName, setPlayerName] = useState(
    () => localStorage.getItem('poker-player-name') || null
  );
  const [roomCode, setRoomCode] = useState(() => getRoomFromURL());
  const [role, setRole] = useState(() => localStorage.getItem('poker-role') || 'player');

  const handleSetName = (name) => {
    setPlayerName(name);
  };

  const handleJoinRoom = (code, selectedRole) => {
    if (selectedRole) {
      setRole(selectedRole);
      localStorage.setItem('poker-role', selectedRole);
    }
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

  // Gallery mode for testing
  if (getGalleryMode()) {
    return <FigureGallery />;
  }

  // Step 1: Name prompt
  if (!playerName) {
    return <NamePrompt onSubmit={handleSetName} />;
  }

  // Step 2: Landing (no room)
  if (!roomCode) {
    return <Landing playerName={playerName} onJoinRoom={handleJoinRoom} />;
  }

  // Step 3: In a room
  return <Room roomCode={roomCode} playerName={playerName} role={role} />;
}
