import { useMemo } from 'react';
import { roundToCard, computeMedian } from './resultModal.utils';
import { pixel } from './room/styles';

// Compute the card to display on the reveal background. We take the
// median of the numeric votes (per Mike Cohn — see resultModal.utils.js
// computeMedian for rationale) and round to the nearest card in the deck
// (1,2,3,5,8,13,21), with exact ties rounding UP pessimistically. This
// must stay in sync with computeStats so the modal and the background
// agree on the displayed card.
function getDisplayCard(players, field) {
  // Filter out non-voters BEFORE Number() coercion. Number(null) === 0,
  // not NaN — without the explicit `!= null` guard, a player who joined
  // the round but hasn't voted yet was counted as a literal 0, pulling
  // the displayed median toward zero (and disagreeing with ResultModal,
  // which pre-filters null votes).
  const nums = Object.values(players)
    .map(p => p?.[field])
    .filter(v => v != null)
    .map(v => Number(v))
    .filter(n => !Number.isNaN(n));
  const m = computeMedian(nums);
  if (m == null) return null;
  const card = roundToCard(m);
  return card == null ? null : String(card);
}

function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return s / 2147483647;
  };
}

export default function RevealBackground({ players, splitMode }) {
  const items = useMemo(() => {
    const result = [];
    const rng = seededRandom(42);
    const count = 30;

    if (splitMode) {
      const feVal = getDisplayCard(players, 'voteFe');
      const beVal = getDisplayCard(players, 'voteBe');

      for (let i = 0; i < count; i++) {
        const isFe = i % 2 === 0;
        const val = isFe ? feVal : beVal;
        if (!val) continue;
        result.push({
          value: val,
          color: isFe ? '#3498db' : '#27ae60',
          left: `${rng() * 90}%`,
          top: `${rng() * 85}%`,
          size: 2.5 + rng() * 4,
          rotation: -20 + rng() * 40,
          delay: rng() * 0.8,
        });
      }
    } else {
      const val = getDisplayCard(players, 'vote');
      if (!val) return [];

      for (let i = 0; i < count; i++) {
        result.push({
          value: val,
          color: '#b08030',
          left: `${rng() * 90}%`,
          top: `${rng() * 85}%`,
          size: 2.5 + rng() * 5,
          rotation: -25 + rng() * 50,
          delay: rng() * 0.8,
        });
      }
    }

    return result;
  }, [players, splitMode]);

  if (items.length === 0) return null;

  return (
    <div style={styles.container}>
      {items.map((item, i) => (
        <div
          key={i}
          className="reveal-number"
          style={{
            ...styles.number,
            left: item.left,
            top: item.top,
            fontSize: `${item.size}rem`,
            color: item.color,
            transform: `rotate(${item.rotation}deg)`,
            animationDelay: `${item.delay}s`,
            animationName: 'revealNumberPop',
            animationDuration: '8s',
            animationTimingFunction: 'ease-out',
            animationFillMode: 'forwards',
          }}
        >
          {item.value}
        </div>
      ))}
    </div>
  );
}

const styles = {
  container: {
    position: 'fixed',
    inset: 0,
    zIndex: 5,
    pointerEvents: 'none',
    overflow: 'hidden',
    animation: 'revealBgFade 8s ease-in-out forwards',
  },
  number: {
    position: 'absolute',
    fontFamily: pixel,
    fontWeight: 'bold',
    opacity: 0,
    /* animation set via inline styles to avoid shorthand conflict */
    textShadow: '2px 2px 0 rgba(0,0,0,0.1)',
  },
};
