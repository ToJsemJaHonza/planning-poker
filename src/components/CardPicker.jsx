import { pixel } from './room/styles';

const CARD_VALUES = ['3', '5', '8', '13', '21', '?', '☕'];

export default function CardPicker({ selectedVote, onVote, disabled, label, accentColor, bottomOffset = 0 }) {
  return (
    <div data-card-picker style={{ ...styles.container, bottom: bottomOffset }}>
      {label && (
        <div style={{ ...styles.label, color: accentColor || '#d4a853' }}>
          {label}
        </div>
      )}
      <div data-card-row style={styles.cards}>
        {CARD_VALUES.map((value) => (
          <button
            key={value}
            data-card
            className={`poker-card${selectedVote === value ? ' poker-card--selected' : ''}`}
            onClick={() => onVote(value)}
            disabled={disabled}
            style={{
              ...styles.card,
              ...(selectedVote === value ? { border: `3px solid ${accentColor || '#d4a853'}` } : {}),
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
    <div data-split-picker style={{ ...styles.splitContainer, bottom: bottomOffset }}>
      <div data-split-row style={styles.splitRow}>
        <div data-split-label style={{ ...styles.splitLabel, color: '#3498db' }}>FE</div>
        <div data-split-cards style={styles.splitCards}>
          {CARD_VALUES.map((value) => (
            <button
              key={value}
              data-split-card
              className={`poker-card poker-card--split${voteFe === value ? ' poker-card--selected' : ''}`}
              onClick={() => onVoteFe(value)}
              disabled={disabled}
              style={{
                ...styles.splitCard,
                ...(voteFe === value ? { border: '3px solid #3498db' } : {}),
              }}
            >
              {value}
            </button>
          ))}
        </div>
      </div>
      <div data-split-row style={styles.splitRow}>
        <div data-split-label style={{ ...styles.splitLabel, color: '#27ae60' }}>BE</div>
        <div data-split-cards style={styles.splitCards}>
          {CARD_VALUES.map((value) => (
            <button
              key={value}
              data-split-card
              className={`poker-card poker-card--split${voteBe === value ? ' poker-card--selected' : ''}`}
              onClick={() => onVoteBe(value)}
              disabled={disabled}
              style={{
                ...styles.splitCard,
                ...(voteBe === value ? { border: '3px solid #27ae60' } : {}),
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
    color: '#2a2a3a',
    boxShadow: '2px 2px 0 #b8922e',
  },
};
