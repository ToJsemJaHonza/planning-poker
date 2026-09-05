import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Room from '../src/components/Room';
import { getSessionIdentity } from '../src/sessionIdentity';
import { setMotionMode } from '../src/engine/motionProbe';
import { db, get, ref, set, onValue } from './session-firebase';
import '../src/index.css';

const params = new URLSearchParams(location.search);
const client = params.get('client') || 'player';
const mode = params.get('motion') || 'full';
setMotionMode(mode);
if (mode === 'none') {
  const style = document.createElement('style');
  style.textContent = '* { animation: none !important; transition: none !important; }';
  document.head.appendChild(style);
}
const identity = getSessionIdentity();
function SessionDebug() {
  const [record, setRecord] = useState(null);
  useEffect(() => onValue(ref(db, `rooms/QA1234/players/${identity.playerId}`), snap => setRecord(snap.val())), []);
  return <output style={{ maxWidth: 260, fontSize: 10 }}>My connection: {record ? JSON.stringify(record) : 'missing'}</output>;
}
const roomRef = ref(db, 'rooms/QA1234');
if (!(await get(roomRef)).exists()) await set(roomRef, {
  meta: { createdAt: Date.now() - 60000, phase: 'voting', task: 'Duplicate session QA', roomStartCrowned: true, splitMode: params.has('split') },
  players: { observer: { name: 'PM', role: 'pm', joinedAt: 1, isLeader: true, disconnected: false } },
});

const root = import.meta.hot?.data.root || createRoot(document.getElementById('root'));
if (import.meta.hot) import.meta.hot.data.root = root;
root.render(<React.StrictMode>
  <nav style={{ position: 'fixed', right: 12, bottom: 160, zIndex: 1000, display: 'flex', flexWrap: 'wrap', gap: 12,
    maxWidth: 'calc(100vw - 24px)', background: '#f5f0e4', border: '2px solid #d4a853', padding: 8,
    fontFamily: "'Press Start 2P', monospace", fontSize: 8, lineHeight: 1.8 }}>
    {params.has('debug') && <output>Navigation: {performance.getEntriesByType('navigation')[0]?.type}; reload identity: {identity.previousPlayerId ? 'yes' : 'no'}</output>}
    {params.has('debug') && client !== 'pm' && <SessionDebug />}
    <a href={`?client=player&motion=${mode}`} target="_blank" rel="noopener noreferrer">Join another tab</a>
    <a href={`?client=pm&motion=${mode}`} target="_blank" rel="noopener noreferrer">PM view</a>
    <button style={{ font: 'inherit', padding: '2px 5px' }} onClick={async () => {
      const id = `guest-${crypto.randomUUID()}`;
      await set(ref(db, `rooms/QA1234/players/${id}`), {
        name: 'Guest', role: 'player', joinedAt: Date.now(), disconnected: false,
      });
    }}>Add test player</button>
    <button style={{ font: 'inherit', padding: '2px 5px' }} onClick={async () => { await set(roomRef, null); location.href = `?client=player&motion=${mode}&split`; }}>New split test</button>
  </nav>
  <Room roomCode="QA1234" playerId={client === 'pm' ? 'observer' : identity.playerId}
    playerName={client === 'pm' ? 'PM' : 'Alice'} role={client === 'pm' ? 'pm' : 'player'}
    sessionIdentity={client === 'pm' ? {} : identity} />
</React.StrictMode>);
