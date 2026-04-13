const pixel = "'Press Start 2P', monospace";

const hiddenPattern = {
  background: `
    linear-gradient(45deg, #d4a853 25%, transparent 25%),
    linear-gradient(-45deg, #d4a853 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #d4a853 75%),
    linear-gradient(-45deg, transparent 75%, #d4a853 75%)
  `,
  backgroundSize: '8px 8px',
  backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0px',
  color: 'transparent',
};

const cardBase = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '0',
  fontFamily: pixel,
  fontWeight: 'bold',
};

const cardStyles = {
  cardSlot: {
    width: '56px', height: '80px',
    display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
    marginBottom: '4px',
  },
  card: { ...cardBase, width: '52px', height: '72px', fontSize: '1rem' },
  cardHidden: {
    ...hiddenPattern,
    backgroundColor: '#2c3e6b',
    border: '3px solid #d4a853',
    boxShadow: '2px 2px 0 #1a2540',
  },
  cardRevealed: {
    background: '#f5f0e4',
    border: '3px solid #d4a853',
    color: '#2a2a3a',
    boxShadow: '2px 2px 0 #b8922e',
  },
  splitCardRow: { display: 'flex', gap: '4px', marginBottom: '4px' },
  splitSlot: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' },
  splitLabel: { fontSize: '0.35rem', fontFamily: pixel, color: '#888' },
  splitCard: { ...cardBase, width: '36px', height: '50px', fontSize: '0.75rem' },
  splitCardEmpty: { width: '36px', height: '50px' },
  cardHiddenFe: {
    ...hiddenPattern,
    backgroundColor: '#2c5a8b',
    border: '3px solid #3498db',
    boxShadow: '2px 2px 0 #1a3a5a',
  },
  cardHiddenBe: {
    ...hiddenPattern,
    backgroundColor: '#2c6b3e',
    border: '3px solid #27ae60',
    boxShadow: '2px 2px 0 #1a4028',
  },
};

/** Single voting card above a player figure. */
export function SingleCard({ data, phase }) {
  const hasVoted = data.vote != null;
  return (
    <div style={cardStyles.cardSlot}>
      {hasVoted && (
        <div style={{
          ...cardStyles.card,
          ...(phase === 'revealed' ? cardStyles.cardRevealed : cardStyles.cardHidden),
        }}>
          {phase === 'revealed' ? data.vote : '?'}
        </div>
      )}
    </div>
  );
}

/** FE/BE split voting cards above a player figure. */
export function SplitCards({ data, phase }) {
  const hasVotedFe = data.voteFe != null;
  const hasVotedBe = data.voteBe != null;
  return (
    <div style={cardStyles.splitCardRow}>
      <div style={cardStyles.splitSlot}>
        <div style={cardStyles.splitLabel}>FE</div>
        {hasVotedFe ? (
          <div style={{
            ...cardStyles.splitCard,
            ...(phase === 'revealed' ? cardStyles.cardRevealed : cardStyles.cardHiddenFe),
          }}>
            {phase === 'revealed' ? data.voteFe : '?'}
          </div>
        ) : (
          <div style={cardStyles.splitCardEmpty} />
        )}
      </div>
      <div style={cardStyles.splitSlot}>
        <div style={cardStyles.splitLabel}>BE</div>
        {hasVotedBe ? (
          <div style={{
            ...cardStyles.splitCard,
            ...(phase === 'revealed' ? cardStyles.cardRevealed : cardStyles.cardHiddenBe),
          }}>
            {phase === 'revealed' ? data.voteBe : '?'}
          </div>
        ) : (
          <div style={cardStyles.splitCardEmpty} />
        )}
      </div>
    </div>
  );
}
