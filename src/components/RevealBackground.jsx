import { useMemo } from 'react';

const pixel = "'Press Start 2P', monospace";

function getConsensus(players, field) {
  const votes = Object.values(players)
    .map(p => p[field])
    .filter(v => v != null && !isNaN(Number(v)));
  if (votes.length === 0) return null;
  // Most common vote
  const counts = {};
  votes.forEach(v => { counts[v] = (counts[v] || 0) + 1; });
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
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
      const feVal = getConsensus(players, 'voteFe');
      const beVal = getConsensus(players, 'voteBe');

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
      const val = getConsensus(players, 'vote');
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
    animation: 'revealNumberPop 8s ease-out forwards',
    textShadow: '2px 2px 0 rgba(0,0,0,0.1)',
  },
};
