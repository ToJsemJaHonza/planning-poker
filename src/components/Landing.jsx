import { useState } from 'react';
import { generateRoomCode } from '../hooks/useRoom';
import { pixel } from './room/styles';

export default function Landing({ playerName, onJoinRoom }) {
  const [joinCode, setJoinCode] = useState('');
  const [showRolePick, setShowRolePick] = useState(false);

  const handleCreate = () => {
    setShowRolePick(true);
  };

  const handlePickRole = (role) => {
    const code = generateRoomCode();
    onJoinRoom(code, role);
  };

  const handleJoin = (e) => {
    e.preventDefault();
    // Strict 6-char alphanumeric room code — prevents any Firebase path
    // injection via crafted inputs like "AB/../meta". generateRoomCode
    // always produces values matching this shape.
    const code = joinCode.trim().toUpperCase();
    if (/^[A-Z0-9]{6}$/.test(code)) {
      onJoinRoom(code, 'player'); // joining = always player
    }
  };

  // Role selection after clicking "Vytvořit místnost"
  if (showRolePick) {
    return (
      <div data-landing style={styles.container}>
        <h1 style={styles.title}>Planning Poker</h1>
        <p style={styles.subtitle}>What's your role?</p>

        <div data-role-row style={styles.roleRow}>
          <button onClick={() => handlePickRole('player')} style={styles.roleBtn}>
            <div style={styles.roleEmoji}>🎮</div>
            <div style={styles.roleLabel}>Player</div>
            <div style={styles.roleDesc}>I vote & estimate</div>
          </button>
          <button onClick={() => handlePickRole('pm')} style={styles.roleBtn}>
            <div style={styles.roleEmoji}>📋</div>
            <div style={styles.roleLabel}>Manager</div>
            <div style={styles.roleDesc}>I run the session</div>
          </button>
        </div>

        <button onClick={() => setShowRolePick(false)} style={styles.changeName}>
          Back
        </button>
      </div>
    );
  }

  return (
    <div data-landing style={styles.container}>
      <h1 style={styles.title}>Planning Poker</h1>
      <p style={styles.greeting}>Hi, {playerName}!</p>

      <div style={styles.actions}>
        <button onClick={handleCreate} style={styles.createBtn}>
          Create Room
        </button>

        <div style={styles.divider}>or</div>

        <form onSubmit={handleJoin} style={styles.joinForm}>
          <input
            type="text"
            value={joinCode}
            onChange={(e) =>
              // Strip anything that isn't an uppercase alphanumeric so
              // copy-pasted junk (slashes, spaces, punctuation) can't land
              // in the room code and leak into Firebase paths.
              setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))
            }
            placeholder="CODE"
            style={styles.input}
            maxLength={6}
          />
          <button type="submit" style={styles.joinBtn} disabled={!joinCode.trim()}>
            Join
          </button>
        </form>
      </div>

      <button
        onClick={() => {
          localStorage.removeItem('poker-player-name');
          window.location.reload();
        }}
        style={styles.changeName}
      >
        Change name
      </button>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100dvh',
    background: '#e8dcc8',
    fontFamily: pixel,
  },
  title: {
    fontSize: '1.2rem',
    color: '#d4a853',
    marginBottom: '0.5rem',
  },
  greeting: {
    fontSize: '0.6rem',
    color: '#888',
    marginBottom: '1.5rem',
  },
  subtitle: {
    fontSize: '0.65rem',
    color: '#555',
    marginBottom: '1.5rem',
  },
  roleRow: {
    display: 'flex',
    gap: '1rem',
  },
  roleBtn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '1.2rem 1.5rem',
    background: '#f5f0e4',
    border: '3px solid #d4a853',
    cursor: 'pointer',
    fontFamily: pixel,
    boxShadow: '4px 4px 0 #b8922e',
  },
  roleEmoji: {
    fontSize: '2rem',
  },
  roleLabel: {
    fontSize: '0.65rem',
    color: '#2a2a3a',
    fontWeight: 'bold',
  },
  roleDesc: {
    fontSize: '0.4rem',
    color: '#888',
  },
  actions: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.8rem',
    padding: '1.5rem',
    background: '#f5f0e4',
    border: '3px solid #d4a853',
    boxShadow: '4px 4px 0 #b8922e',
    minWidth: '280px',
  },
  createBtn: {
    padding: '0.6rem 1.5rem',
    fontSize: '0.65rem',
    background: '#d4a853',
    color: '#1e1e2e',
    border: '3px solid #b8922e',
    cursor: 'pointer',
    fontFamily: pixel,
    width: '100%',
  },
  divider: {
    color: '#888',
    fontSize: '0.5rem',
  },
  joinForm: {
    display: 'flex',
    gap: '0.5rem',
    width: '100%',
  },
  input: {
    flex: 1,
    padding: '0.5rem',
    fontSize: '0.7rem',
    border: '3px solid #d4a853',
    textAlign: 'center',
    fontFamily: pixel,
    letterSpacing: '3px',
    background: '#fff',
  },
  joinBtn: {
    padding: '0.5rem 0.8rem',
    fontSize: '0.55rem',
    background: '#2a2a3a',
    color: '#d4a853',
    border: '3px solid #1a1a2a',
    cursor: 'pointer',
    fontFamily: pixel,
  },
  changeName: {
    marginTop: '0.8rem',
    background: 'none',
    border: 'none',
    color: '#888',
    cursor: 'pointer',
    fontSize: '0.45rem',
    textDecoration: 'underline',
    fontFamily: pixel,
  },
};
