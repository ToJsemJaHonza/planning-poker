import { useState } from 'react';

export default function NamePrompt({ onSubmit }) {
  const [name, setName] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    // Strip Firebase-unsafe characters: . $ # [ ] /
    const sanitized = name.trim().replace(/[.$#\[\]/]/g, '');
    if (sanitized && sanitized.length >= 1) {
      localStorage.setItem('poker-player-name', sanitized);
      onSubmit(sanitized);
    }
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
        />
        <button type="submit" style={styles.button} disabled={!name.trim()}>
          Enter
        </button>
      </form>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    background: '#f5f0e8',
    fontFamily: 'Georgia, serif',
  },
  title: {
    fontSize: '2.5rem',
    color: '#333',
    marginBottom: '2rem',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1rem',
    padding: '2rem',
    background: '#fff',
    borderRadius: '8px',
    border: '2px solid #d4a853',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  label: {
    fontSize: '1.1rem',
    color: '#555',
  },
  input: {
    padding: '0.6rem 1rem',
    fontSize: '1.1rem',
    border: '2px solid #d4a853',
    borderRadius: '4px',
    outline: 'none',
    textAlign: 'center',
    fontFamily: 'monospace',
  },
  button: {
    padding: '0.6rem 2rem',
    fontSize: '1.1rem',
    background: '#d4a853',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontFamily: 'Georgia, serif',
  },
};
