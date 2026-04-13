import { useState } from 'react';
import { pixel } from './room/styles';

export default function NamePrompt({ onSubmit }) {
  const [name, setName] = useState('');
  const sanitized = name.trim().replace(/[.$#\[\]/]/g, '');
  const showInvalidHint = name.trim().length > 0 && sanitized.length === 0;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!sanitized) return;
    localStorage.setItem('poker-player-name', sanitized);
    onSubmit(sanitized);
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Planning Poker</h1>
      <form onSubmit={handleSubmit} style={styles.form}>
        <label style={styles.label}>What's your name?</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name..."
          style={styles.input}
          autoFocus
          maxLength={20}
          aria-invalid={showInvalidHint}
        />
        {showInvalidHint && (
          <p data-testid="name-hint" style={styles.hint}>
            Use letters or numbers (no . $ # [ ] /)
          </p>
        )}
        <button type="submit" style={styles.button} disabled={!sanitized}>
          Enter
        </button>
      </form>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    minHeight: '100vh', background: '#e8dcc8', fontFamily: pixel, padding: '1rem',
  },
  title: {
    fontSize: '1.4rem', color: '#d4a853', margin: 0, marginBottom: '0.4rem',
    textShadow: '3px 3px 0 #2a2a3a', letterSpacing: '1px', textAlign: 'center',
  },
  form: {
    display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: '0.9rem',
    padding: '1.5rem', background: '#f5f0e4', border: '3px solid #d4a853',
    borderRadius: 0, boxShadow: '4px 4px 0 #b8922e', minWidth: '280px', maxWidth: '320px',
  },
  label: { fontSize: '0.6rem', color: '#2a2a3a', letterSpacing: '1px' },
  input: {
    padding: '0.7rem 0.6rem', fontSize: '0.75rem', border: '3px solid #d4a853',
    borderRadius: 0, outline: 'none', textAlign: 'center', fontFamily: pixel,
    background: '#fff', color: '#2a2a3a', letterSpacing: '1px',
  },
  button: {
    padding: '0.7rem 1rem', fontSize: '0.7rem', background: '#d4a853', color: '#1e1e2e',
    border: '3px solid #b8922e', borderRadius: 0, cursor: 'pointer', fontFamily: pixel,
    boxShadow: '4px 4px 0 #8a6a1f', letterSpacing: '1px',
  },
  hint: {
    fontSize: '0.45rem', color: '#c0392b', fontFamily: pixel, lineHeight: 1.5, margin: 0,
    padding: '0.3rem 0.4rem', border: '2px solid #c0392b', background: '#f7e3e0',
    textAlign: 'center', letterSpacing: '0.5px',
  },
};
