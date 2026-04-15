import { useEffect, useRef, useState } from 'react';
import { pixel } from './styles';

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

export default function RoomHeader({ roomCode, playerCount }) {
  const [copied, setCopied] = useState(false);
  // When the clipboard API is unavailable or denied (Safari without HTTPS,
  // older iOS, locked-down browsers), we surface a fallback modal with the
  // URL pre-selected so the user can long-press / cmd+c manually instead
  // of being told "copy failed" with nowhere to go.
  const [fallbackUrl, setFallbackUrl] = useState(null);
  const fallbackInputRef = useRef(null);

  const handleCopyLink = async () => {
    const url = `${window.location.origin}${window.location.pathname}?room=${roomCode}`;
    if (!navigator.clipboard?.writeText) {
      setFallbackUrl(url);
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setFallbackUrl(url);
    }
  };

  // Auto-select the URL when the fallback opens so a long-press/keyboard
  // copy lands on the right text.
  useEffect(() => {
    if (fallbackUrl && fallbackInputRef.current) {
      fallbackInputRef.current.focus();
      fallbackInputRef.current.select();
    }
  }, [fallbackUrl]);

  const closeFallback = () => setFallbackUrl(null);

  return (
    <div style={styles.header} data-room-header>
      <div style={styles.headerLeft} data-header-left>
        <h2 style={styles.roomTitle} data-room-title>Room: {roomCode}</h2>
        <span style={styles.playerCount} data-player-count>{plural(playerCount, 'player')}</span>
      </div>
      <div style={styles.headerRight}>
        <button onClick={handleCopyLink} style={styles.copyBtn} data-copy-btn>
          {copied ? '✓ Copied' : '📋 Invite'}
        </button>
      </div>

      {fallbackUrl && (
        <div
          style={styles.fallbackOverlay}
          data-clipboard-fallback
          onClick={closeFallback}
        >
          <div
            style={styles.fallbackModal}
            data-clipboard-fallback-modal
            onClick={(e) => e.stopPropagation()}
          >
            <div style={styles.fallbackTitle}>Copy this link</div>
            <div style={styles.fallbackHelp}>
              Your browser blocked auto-copy. Tap the field, then copy.
            </div>
            <input
              ref={fallbackInputRef}
              type="text"
              readOnly
              value={fallbackUrl}
              style={styles.fallbackInput}
              data-clipboard-fallback-input
              onFocus={(e) => e.target.select()}
            />
            <button
              onClick={closeFallback}
              style={styles.fallbackCloseBtn}
              data-clipboard-fallback-close
            >
              Close
            </button>
          </div>
        </div>
      )}
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
  fallbackOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
    padding: '1rem',
  },
  fallbackModal: {
    background: '#f5f0e4',
    border: '4px solid #d4a853',
    padding: '1.2rem',
    minWidth: '260px',
    maxWidth: '90vw',
    fontFamily: pixel,
    boxShadow: '6px 6px 0 #b8922e',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.6rem',
  },
  fallbackTitle: {
    fontSize: '0.7rem',
    color: '#d4a853',
    fontWeight: 'bold',
  },
  fallbackHelp: {
    fontSize: '0.45rem',
    color: '#888',
    lineHeight: 1.4,
  },
  fallbackInput: {
    padding: '0.5rem',
    fontSize: '0.55rem',
    border: '3px solid #d4a853',
    fontFamily: pixel,
    background: '#fff',
    color: '#2a2a3a',
    width: '100%',
    boxSizing: 'border-box',
  },
  fallbackCloseBtn: {
    padding: '0.4rem 0.8rem',
    background: '#2a2a3a',
    color: '#d4a853',
    border: '3px solid #1a1a2a',
    cursor: 'pointer',
    fontSize: '0.55rem',
    fontFamily: pixel,
    alignSelf: 'flex-end',
  },
};
