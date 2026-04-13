import { useState, useEffect, useRef } from 'react';
import { pixel } from '../room/styles';

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

/**
 * Flip state machine for a single card.
 * idle → flip-out (250ms) → flip-in (250ms) → bounce (200ms) → done
 */
function useCardFlip(phase, staggerMs) {
  // If mounted with phase=revealed (late join, tests), skip directly to 'done'
  const [flipStage, setFlipStage] = useState(phase === 'revealed' ? 'done' : 'idle');
  const prevPhaseRef = useRef(phase);
  const timersRef = useRef([]);

  useEffect(() => {
    // Clear any running timers
    return () => timersRef.current.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    const prev = prevPhaseRef.current;
    prevPhaseRef.current = phase;

    if (prev === 'voting' && phase === 'revealed') {
      // Start flip sequence after stagger delay
      const t1 = setTimeout(() => {
        setFlipStage('flip-out');
        const t2 = setTimeout(() => {
          setFlipStage('flip-in');
          const t3 = setTimeout(() => {
            setFlipStage('bounce');
            const t4 = setTimeout(() => {
              setFlipStage('done');
            }, 200);
            timersRef.current.push(t4);
          }, 250);
          timersRef.current.push(t3);
        }, 250);
        timersRef.current.push(t2);
      }, staggerMs);
      timersRef.current.push(t1);
    } else if (phase === 'voting') {
      // New round — reset
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
      setFlipStage('idle');
    }
  }, [phase, staggerMs]);

  return flipStage;
}

/** Get the CSS class for the current flip stage */
function flipClass(stage) {
  switch (stage) {
    case 'flip-out': return 'card-flip-out';
    case 'flip-in': return 'card-flip-in';
    case 'bounce': return 'card-flip-bounce';
    default: return '';
  }
}

/** Should the card show revealed content? */
function showRevealed(phase, flipStage) {
  if (phase !== 'revealed') return false;
  // Show hidden during flip-out (rotating away), revealed from flip-in onward
  if (flipStage === 'flip-out') return false;
  if (flipStage === 'idle') return false; // waiting for stagger
  return true;
}

/** Single voting card above a player figure. */
export function SingleCard({ data, phase, playerIndex = 0 }) {
  const hasVoted = data.vote != null;
  const flipStage = useCardFlip(phase, playerIndex * 80);
  const revealed = showRevealed(phase, flipStage);
  const cls = flipClass(flipStage);

  return (
    <div style={cardStyles.cardSlot} className="card-flip-container">
      {hasVoted && (
        <div
          className={cls}
          style={{
            ...cardStyles.card,
            ...(revealed ? cardStyles.cardRevealed : cardStyles.cardHidden),
          }}
        >
          {revealed ? data.vote : '?'}
        </div>
      )}
    </div>
  );
}

/** FE/BE split voting cards above a player figure. */
export function SplitCards({ data, phase, playerIndex = 0 }) {
  const hasVotedFe = data.voteFe != null;
  const hasVotedBe = data.voteBe != null;
  const flipStageFe = useCardFlip(phase, playerIndex * 80);
  const flipStageBe = useCardFlip(phase, playerIndex * 80 + 100);
  const revealedFe = showRevealed(phase, flipStageFe);
  const revealedBe = showRevealed(phase, flipStageBe);

  return (
    <div style={cardStyles.splitCardRow}>
      <div style={cardStyles.splitSlot} className="card-flip-container">
        <div style={cardStyles.splitLabel}>FE</div>
        {hasVotedFe ? (
          <div
            className={flipClass(flipStageFe)}
            style={{
              ...cardStyles.splitCard,
              ...(revealedFe ? cardStyles.cardRevealed : cardStyles.cardHiddenFe),
            }}
          >
            {revealedFe ? data.voteFe : '?'}
          </div>
        ) : (
          <div style={cardStyles.splitCardEmpty} />
        )}
      </div>
      <div style={cardStyles.splitSlot} className="card-flip-container">
        <div style={cardStyles.splitLabel}>BE</div>
        {hasVotedBe ? (
          <div
            className={flipClass(flipStageBe)}
            style={{
              ...cardStyles.splitCard,
              ...(revealedBe ? cardStyles.cardRevealed : cardStyles.cardHiddenBe),
            }}
          >
            {revealedBe ? data.voteBe : '?'}
          </div>
        ) : (
          <div style={cardStyles.splitCardEmpty} />
        )}
      </div>
    </div>
  );
}
