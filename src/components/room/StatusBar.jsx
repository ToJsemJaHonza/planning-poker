import { useState, useEffect, useRef } from 'react';
import { pixel } from './styles';

const SPARKLE_CHARS = ['✦', '✦', '★', '✦', '✦', '✦', '★', '✦'];
const SPARKLE_COLORS = ['#d4a853', '#f5c542', '#fff', '#d4a853', '#f5c542', '#fff', '#d4a853', '#f5c542'];

export default function StatusBar({ phase, votedCount, playerCount, allVotedClean = false }) {
  const allVoted = phase === 'voting' && votedCount === playerCount && playerCount > 0;
  const [celebrating, setCelebrating] = useState(false);
  const prevCleanRef = useRef(false);

  // Celebration animation only fires for clean votes (no ? or ☕)
  useEffect(() => {
    if (allVotedClean && !prevCleanRef.current) {
      setCelebrating(true);
      const timer = setTimeout(() => setCelebrating(false), 4500);
      return () => clearTimeout(timer);
    }
    if (!allVotedClean) setCelebrating(false);
    prevCleanRef.current = allVotedClean;
  }, [allVotedClean]);

  return (
    <div
      className={celebrating ? 'status-bar--celebrate' : ''}
      style={styles.pmBar}
    >
      {phase === 'voting' ? (
        <>
          <span className={celebrating ? 'celebrate-text-pop' : ''} style={styles.pmBarText}>
            {allVoted
              ? '✓ Everyone voted!'
              : `Waiting for ${playerCount - votedCount} player${playerCount - votedCount === 1 ? '' : 's'}...`}
          </span>
          <span style={styles.pmBarCount}>{votedCount} / {playerCount}</span>
        </>
      ) : (
        <span style={styles.pmBarText}>Results revealed</span>
      )}

      {/* Celebration sparkle particles */}
      {celebrating && (
        <div style={styles.sparkleContainer}>
          {SPARKLE_CHARS.map((ch, i) => (
            <span
              key={i}
              className="sparkle-burst"
              style={{
                ...styles.sparkle,
                color: SPARKLE_COLORS[i],
                '--dx': `${(i % 2 === 0 ? -1 : 1) * (8 + i * 5)}px`,
                '--dy': `${-20 - i * 6}px`,
                animationDelay: `${i * 80}ms`,
                left: `${15 + i * 10}%`,
              }}
            >
              {ch}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

const styles = {
  pmBar: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    padding: '0.5rem 1rem',
    background: '#2a2a3a',
    borderTop: '4px solid #d4a853',
    zIndex: 50,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '1.5rem',
    overflow: 'hidden',
  },
  pmBarText: {
    fontSize: '0.85rem',
    fontFamily: pixel,
    color: '#d4a853',
    letterSpacing: '1px',
  },
  pmBarCount: {
    fontSize: '1.2rem',
    fontFamily: pixel,
    color: '#fff',
  },
  sparkleContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 0,
    pointerEvents: 'none',
    overflow: 'visible',
  },
  sparkle: {
    position: 'absolute',
    top: '-4px',
    fontSize: '0.7rem',
    fontFamily: pixel,
  },
};
