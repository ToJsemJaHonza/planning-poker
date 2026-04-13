import { useState } from 'react';
import { pixel } from './styles';

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

export default function RoomHeader({ roomCode, playerCount }) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);

  const handleCopyLink = async () => {
    const url = `${window.location.origin}${window.location.pathname}?room=${roomCode}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setCopyError(false);
    } catch {
      setCopied(false);
      setCopyError(true);
    }
    setTimeout(() => { setCopied(false); setCopyError(false); }, 2000);
  };

  return (
    <div style={styles.header} data-room-header>
      <div style={styles.headerLeft} data-header-left>
        <h2 style={styles.roomTitle} data-room-title>Room: {roomCode}</h2>
        <span style={styles.playerCount} data-player-count>{plural(playerCount, 'player')}</span>
      </div>
      <div style={styles.headerRight}>
        <button onClick={handleCopyLink} style={styles.copyBtn} data-copy-btn>
          {copied ? '✓ Copied' : copyError ? '✗ Copy failed' : '📋 Invite'}
        </button>
      </div>
    </div>
  );
}

const styles = {
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.6rem 1rem',
    borderBottom: '4px solid #d4a853',
    background: '#f5f0e4',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.8rem',
  },
  roomTitle: {
    margin: 0,
    fontSize: '0.85rem',
    color: '#d4a853',
  },
  playerCount: {
    fontSize: '0.65rem',
    color: '#888',
    fontFamily: pixel,
  },
  headerRight: {
    display: 'flex',
    gap: '0.5rem',
  },
  copyBtn: {
    padding: '0.4rem 0.6rem',
    background: '#d4a853',
    color: '#1e1e2e',
    border: '3px solid #b8922e',
    borderRadius: '0',
    cursor: 'pointer',
    fontSize: '0.6rem',
    fontFamily: pixel,
  },
};
