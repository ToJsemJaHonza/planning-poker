import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Room from '../src/components/Room';
import App from '../src/App';
import { __mock, db, ref, set, update } from '../src/test/firebase-mock';
import { setMotionMode } from '../src/engine/motionProbe';
import '../src/index.css';

const code = 'QA1234';
const names = ['Honza', 'Alice', 'Bob', 'David', 'Karel', 'Alan', 'Fanda', 'Eva', 'Marek', 'Tereza', 'Petr', 'Lenka'];
const params = new URLSearchParams(location.search);
const role = params.get('role') || 'player';
const viewer = Number(params.get('viewer') || 0);
const mode = params.get('motion') || 'full';
setMotionMode(mode);
if (mode !== 'full') {
  const style = document.createElement('style');
  style.textContent = '* { animation: none !important; transition: none !important; }';
  document.head.append(style);
}
const players = Object.fromEntries(names.slice(0, Number(params.get('count') || 4)).map((name, i) => [
  `qa-${i}`, { name, role: i === 0 ? role : 'player', isLeader: i === 0, joinedAt: Date.now() - 60000 + i },
]));
__mock.setStore({ '.info': { connected: true }, rooms: { [code]: {
  meta: { phase: 'voting', task: 'Browser animation QA', createdAt: Date.now(), roomStartCrowned: true }, players,
} } });

function QA() {
  const [open, setOpen] = useState(false);
  const [connected, setConnected] = useState(true);
  const allVote = async () => {
    const room = __mock.getStore().rooms[code];
    const changes = {};
    Object.keys(room.players).forEach(id => {
      changes[`${id}/vote`] = '8'; changes[`${id}/voteFe`] = '5'; changes[`${id}/voteBe`] = '8';
    });
    await update(ref(db, `rooms/${code}/players`), changes);
  };
  const entrance = async (type, playerId) => {
    await set(ref(db, `rooms/${code}/meta/syncedEvent`), { type, playerId, playerName: players[playerId].name, timestamp: Date.now(), fromLeft: true });
  };
  return <>
    <Room roomCode={code} playerId={`qa-${viewer}`} playerName={names[viewer]} role={viewer === 0 ? role : 'player'} />
    <aside style={{ position: 'fixed', right: 8, top: 70, zIndex: 500, background: '#fff', padding: 4, font: '12px monospace' }}>
      <button onClick={() => setOpen(!open)}>QA controls</button>
      {open && <div style={{ display: 'grid', gap: 8, padding: 8 }}>
        <button onClick={allVote}>Everyone votes</button>
        <button onClick={() => update(ref(db, `rooms/${code}/meta`), { phase: 'revealed' })}>Reveal from leader</button>
        <button onClick={() => set(ref(db, `rooms/${code}/players/guest`), { name: 'Guest', joinedAt: Date.now(), role: 'player' })}>Join guest</button>
        <button onClick={() => __mock.removePlayer(code, 'guest')}>Leave guest</button>
        <button onClick={() => { __mock.setConnectedState(!connected); setConnected(!connected); }}>Toggle connection</button>
        <button onClick={() => entrance('train', 'qa-3')}>Train entrance</button>
        <button disabled={!players['qa-4']} onClick={() => entrance('dbbPipeline', 'qa-4')}>Pipe entrance</button>
        <button onClick={() => update(ref(db, `rooms/${code}/players/qa-0`), { disconnected: true })}>Leader leaves</button>
        <button onClick={() => update(ref(db, `rooms/${code}/players/qa-0`), { disconnected: false })}>Leader returns</button>
        <button onClick={() => set(ref(db, `rooms/${code}/meta/syncedEvent`), { type: 'chicken', timestamp: Date.now() })}>Chicken</button>
        <button onClick={() => set(ref(db, `rooms/${code}/meta/syncedEvent`), { type: 'okta', timestamp: Date.now() })}>Sheep</button>
        <button onClick={() => set(ref(db, `rooms/${code}/meta/shameTimer`), { holdoutId: 'qa-0', holdoutName: 'Honza', startedAt: Date.now() - 101000 })}>Shame stage 5</button>
      </div>}
    </aside>
  </>;
}

const root = import.meta.hot?.data.root || createRoot(document.getElementById('root'));
if (import.meta.hot) import.meta.hot.data.root = root;
root.render(<StrictMode>{params.has('app') ? <App /> : <QA />}</StrictMode>);
