import { pixel } from './styles';

export default function PhaseBar({
  phase,
  splitMode,
  votedCount,
  playerCount,
  canControl,
  onToggleSplit,
  onReveal,
  onNewRound,
}) {
  return (
    <div style={styles.phaseBar}>
      <span style={styles.phaseLabel}>
        {phase === 'voting'
          ? `Voting (${votedCount}/${playerCount})${splitMode ? ' FE/BE' : ''}`
          : 'Results'}
      </span>

      {canControl && phase === 'voting' && (
        <>
          <button
            onClick={onToggleSplit}
            style={{
              ...styles.splitBtn,
              ...(splitMode ? styles.splitBtnActive : {}),
            }}
          >
            {splitMode ? '✂ FE/BE' : '✂ Split'}
          </button>
          <button
            onClick={onReveal}
            style={styles.revealBtn}
            disabled={votedCount === 0}
          >
            Reveal Cards
          </button>
        </>
      )}
      {canControl && phase === 'revealed' && (
        <button onClick={onNewRound} style={styles.newRoundBtn}>
          New Round
        </button>
      )}
    </div>
  );
}

const styles = {
  phaseBar: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '0.6rem',
    padding: '0.8rem',
    flexWrap: 'wrap',
  },
  phaseLabel: {
    fontSize: '0.65rem',
    color: '#888',
    fontFamily: pixel,
  },
  splitBtn: {
    padding: '0.4rem 0.6rem',
    background: '#f5f0e4',
    color: '#888',
    border: '3px solid #ccc',
    borderRadius: '0',
    cursor: 'pointer',
    fontSize: '0.55rem',
    fontFamily: pixel,
  },
  splitBtnActive: {
    background: '#3498db',
    color: '#fff',
    border: '3px solid #2980b9',
  },
  revealBtn: {
    padding: '0.5rem 1rem',
    background: '#d4a853',
    color: '#1e1e2e',
    border: '3px solid #b8922e',
    borderRadius: '0',
    cursor: 'pointer',
    fontSize: '0.65rem',
    fontFamily: pixel,
  },
  newRoundBtn: {
    padding: '0.5rem 1rem',
    background: '#4caf50',
    color: '#1e1e2e',
    border: '3px solid #3a8a3e',
    borderRadius: '0',
    cursor: 'pointer',
    fontSize: '0.65rem',
    fontFamily: pixel,
  },
};
