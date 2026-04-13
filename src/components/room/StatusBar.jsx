import { pixel } from './styles';

export default function StatusBar({ phase, votedCount, playerCount }) {
  return (
    <div style={styles.pmBar}>
      {phase === 'voting' ? (
        <>
          <span style={styles.pmBarText}>
            {votedCount === playerCount && playerCount > 0
              ? '✓ Everyone voted!'
              : `Waiting for ${playerCount - votedCount} player${playerCount - votedCount === 1 ? '' : 's'}...`}
          </span>
          <span style={styles.pmBarCount}>{votedCount} / {playerCount}</span>
        </>
      ) : (
        <span style={styles.pmBarText}>Results revealed</span>
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
    zIndex: 41,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '1.5rem',
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
};
