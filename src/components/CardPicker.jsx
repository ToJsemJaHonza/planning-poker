const CARD_VALUES = ['1', '2', '3', '5', '8', '13', '21', '?', '☕'];

const pixel = "'Press Start 2P', monospace";

export default function CardPicker({ selectedVote, onVote, disabled, label, accentColor, bottomOffset = 0 }) {
  return (
    <div style={{ ...styles.container, bottom: bottomOffset }}>
      {label && (
        <div style={{ ...styles.label, color: accentColor || '#d4a853' }}>
          {label}
        </div>
      )}
      <div style={styles.cards}>
        {CARD_VALUES.map((value) => (
          <button
            key={value}
            onClick={() => onVote(value)}
            disabled={disabled}
            style={{
              ...styles.card,
              ...(selectedVote === value ? { ...styles.selected, border: `3px solid ${accentColor || '#d4a853'}` } : {}),
              ...(disabled ? styles.disabled : {}),
            }}
          >
            {value}
          </button>
        ))}
      </div>
    </div>
  );
}

// Wrapper for split mode — two pickers stacked
export function SplitCardPicker({ voteFe, voteBe, onVoteFe, onVoteBe, disabled, bottomOffset = 0 }) {
  return (
    <div style={{ ...styles.splitContainer, bottom: bottomOffset }}>
      <div style={styles.splitRow}>
        <div style={{ ...styles.splitLabel, color: '#3498db' }}>FE</div>
        <div style={styles.splitCards}>
          {CARD_VALUES.map((value) => (
            <button
              key={value}
              onClick={() => onVoteFe(value)}
              disabled={disabled}
              style={{
                ...styles.splitCard,
                ...(voteFe === value ? { ...styles.selected, border: '3px solid #3498db' } : {}),
                ...(disabled ? styles.disabled : {}),
              }}
            >
              {value}
            </button>
          ))}
        </div>
      </div>
      <div style={styles.splitRow}>
        <div style={{ ...styles.splitLabel, color: '#27ae60' }}>BE</div>
        <div style={styles.splitCards}>
          {CARD_VALUES.map((value) => (
            <button
              key={value}
              onClick={() => onVoteBe(value)}
              disabled={disabled}
              style={{
                ...styles.splitCard,
                ...(voteBe === value ? { ...styles.selected, border: '3px solid #27ae60' } : {}),
                ...(disabled ? styles.disabled : {}),
              }}
            >
              {value}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    padding: '0.6rem 1rem',
    background: '#2a2a3a',
    borderTop: '4px solid #d4a853',
    zIndex: 40,
  },
  label: {
    textAlign: 'center',
    fontSize: '0.55rem',
    fontFamily: pixel,
    marginBottom: '4px',
  },
  cards: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
    justifyContent: 'center',
  },
  card: {
    width: '48px',
    height: '64px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.85rem',
    fontFamily: pixel,
    border: '3px solid #d4a853',
    borderRadius: '0',
    background: '#f5f0e4',
    cursor: 'pointer',
    transition: 'all 0.1s ease',
    color: '#2a2a3a',
    boxShadow: '3px 3px 0 #b8922e',
  },
  // Split mode styles
  splitContainer: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    padding: '0.4rem 0.6rem',
    background: '#2a2a3a',
    borderTop: '4px solid #d4a853',
    zIndex: 40,
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  splitRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  splitLabel: {
    fontSize: '0.55rem',
    fontFamily: pixel,
    width: '28px',
    textAlign: 'right',
    flexShrink: 0,
  },
  splitCards: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '4px',
    justifyContent: 'center',
    flex: 1,
  },
  splitCard: {
    width: '38px',
    height: '50px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.7rem',
    fontFamily: pixel,
    border: '3px solid #d4a853',
    borderRadius: '0',
    background: '#f5f0e4',
    cursor: 'pointer',
    transition: 'all 0.1s ease',
    color: '#2a2a3a',
    boxShadow: '2px 2px 0 #b8922e',
  },
  selected: {
    background: '#d4a853',
    color: '#2a2a3a',
    transform: 'translate(2px, 2px)',
    boxShadow: '1px 1px 0 #b8922e',
  },
  disabled: {
    opacity: 0.5,
    cursor: 'default',
  },
};
