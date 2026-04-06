import { useState, useEffect, useMemo } from 'react';

const _ = null;
const W = '#e8e8e8'; // white body
const L = '#f5f5f5'; // lighter white
const B = '#3498db'; // blue stripe
const D = '#2980b9'; // dark blue
const K = '#2a2a2a'; // windows/wheels
const R = '#e74c3c'; // nose red
const S = '#aaa';     // silver undercarriage
const Y = '#f5c542'; // headlight
const N = '#555';     // dark details
const C = '#999';     // connector
const G = '#777';     // rail gray
const T = '#8B6b3a'; // rail tie brown

const pixel = "'Press Start 2P', monospace";

// Locomotive: 24w × 12h (bigger, more detail)
const LOCO = [
  [_,_,_,_,_,_,L,L,L,L,L,L,L,L,L,L,L,L,L,L,_,_,_,_],
  [_,_,_,_,_,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,_,_,_],
  [_,_,_,_,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,_,_],
  [_,_,_,R,W,K,K,K,W,K,K,K,W,K,K,K,W,K,K,W,W,W,W,_],
  [_,_,R,R,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,W,_],
  [_,R,R,R,D,B,B,B,B,B,N,N,B,B,B,B,B,B,B,B,D,D,W,_],
  [_,Y,R,R,D,D,D,D,D,D,N,N,D,D,D,D,D,D,D,D,D,D,W,_],
  [_,_,R,R,S,S,S,S,S,S,S,S,S,S,S,S,S,S,S,S,S,S,W,_],
  [_,_,_,S,S,S,S,S,S,S,S,S,S,S,S,S,S,S,S,S,S,_,_,_],
  [_,_,_,_,K,K,K,_,_,K,K,K,_,_,_,K,K,K,_,K,K,K,_,_],
  [_,_,_,_,K,K,K,_,_,K,K,K,_,_,_,K,K,K,_,K,K,K,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
];

// Passenger wagon: 26w × 12h
const WAGON = [
  [C,C,L,L,L,L,L,L,L,L,L,L,L,L,L,L,L,L,L,L,L,L,L,L,C,C],
  [C,C,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,C,C],
  [C,C,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,C,C],
  [C,C,W,K,K,K,W,K,K,K,W,K,K,K,W,K,K,K,W,K,K,K,W,W,C,C],
  [C,C,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,C,C],
  [C,C,D,B,B,B,B,N,N,B,B,B,B,B,B,B,N,N,B,B,B,B,B,D,C,C],
  [C,C,D,D,D,D,D,N,N,D,D,D,D,D,D,D,N,N,D,D,D,D,D,D,C,C],
  [C,C,S,S,S,S,S,S,S,S,S,S,S,S,S,S,S,S,S,S,S,S,S,S,C,C],
  [_,_,S,S,S,S,S,S,S,S,S,S,S,S,S,S,S,S,S,S,S,S,S,S,_,_],
  [_,_,_,K,K,K,_,_,K,K,K,_,_,_,_,K,K,K,_,_,K,K,K,_,_,_],
  [_,_,_,K,K,K,_,_,K,K,K,_,_,_,_,K,K,K,_,_,K,K,K,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
];

const PX = 4; // bigger pixels
const LOCO_W = 24 * PX;
const WAGON_W = 26 * PX;
const CAR_H = 12 * PX;
const NUM_WAGONS = 3;
const TOTAL_W = LOCO_W + WAGON_W * NUM_WAGONS;
const RAIL_H = 8;

function spriteToBoxShadow(grid, px, offsetX = 0) {
  const shadows = [];
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      const c = grid[y][x];
      if (c) shadows.push(`${(x * px) + offsetX}px ${y * px}px 0 ${Math.ceil(px / 2)}px ${c}`);
    }
  }
  return shadows;
}

// Phases: rails → arrive → stopped → bubble → exit → depart → fadeRails → done
export default function Train({ fromRight, onPlayerExit }) {
  const [phase, setPhase] = useState('rails');

  const shadow = useMemo(() => {
    const all = [];
    all.push(...spriteToBoxShadow(LOCO, PX, 0));
    for (let i = 0; i < NUM_WAGONS; i++) {
      all.push(...spriteToBoxShadow(WAGON, PX, LOCO_W + i * WAGON_W));
    }
    return all.join(',');
  }, []);

  useEffect(() => {
    // Rails appear first
    const t0 = setTimeout(() => setPhase('arrive'), 800);
    // Train arrives
    const t1 = setTimeout(() => setPhase('stopped'), 3800);
    // Bubble
    const t2 = setTimeout(() => setPhase('bubble'), 4200);
    // Player exits
    const t3 = setTimeout(() => {
      setPhase('exit');
      onPlayerExit?.();
    }, 6700);
    // Train departs
    const t4 = setTimeout(() => setPhase('depart'), 7700);
    // Rails fade
    const t5 = setTimeout(() => setPhase('fadeRails'), 10200);
    // Done
    const t6 = setTimeout(() => setPhase('done'), 11000);
    return () => { [t0,t1,t2,t3,t4,t5,t6].forEach(clearTimeout); };
  }, [onPlayerExit]);

  if (phase === 'done') return null;

  const showRails = phase !== 'done';
  const showTrain = phase !== 'rails' && phase !== 'fadeRails' && phase !== 'done';
  const railsFading = phase === 'fadeRails';
  const stopX = `calc(50% - ${TOTAL_W / 2}px)`;

  return (
    <div style={styles.container}>
      {/* Speech bubble */}
      {(phase === 'bubble' || phase === 'exit') && (
        <div style={styles.bubble}>
          🚄 Monorepo conductor has arrived 🚄
        </div>
      )}

      {/* Train */}
      {showTrain && (
        <div
          style={{
            ...styles.train,
            width: TOTAL_W,
            transform: fromRight ? 'scaleX(-1)' : 'scaleX(1)',
            ...(phase === 'arrive' ? {
              animation: `trainArrive${fromRight ? 'Right' : 'Left'} 3s ease-out forwards`,
            } : phase === 'depart' ? {
              animation: `trainDepart${fromRight ? 'Right' : 'Left'} 2.5s ease-in forwards`,
            } : {
              left: stopX,
            }),
          }}
        >
          <div style={{ width: 1, height: 1, boxShadow: shadow, position: 'absolute', top: 0, left: 0 }} />
        </div>
      )}

      {/* Rails */}
      {showRails && (
        <div style={{
          ...styles.rails,
          opacity: railsFading ? 0 : 1,
          transition: 'opacity 0.8s ease-out',
        }}>
          {/* Rail lines */}
          <div style={styles.railLine} />
          <div style={{ ...styles.railLine, bottom: 0 }} />
          {/* Ties */}
          <div style={styles.ties} />
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    position: 'fixed',
    bottom: '85px',
    left: 0,
    right: 0,
    height: `${CAR_H + 60}px`,
    zIndex: 180,
    pointerEvents: 'none',
  },
  train: {
    position: 'absolute',
    height: CAR_H,
    bottom: RAIL_H + 4,
  },
  bubble: {
    position: 'absolute',
    top: 0,
    left: '50%',
    transform: 'translateX(-50%)',
    background: '#fff',
    border: '3px solid #e74c3c',
    borderRadius: '0',
    padding: '8px 16px',
    fontSize: '0.7rem',
    fontFamily: pixel,
    color: '#2a2a3a',
    whiteSpace: 'nowrap',
    boxShadow: '4px 4px 0 #c0392b',
    zIndex: 181,
  },
  rails: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: RAIL_H,
  },
  railLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    background: '#888',
  },
  ties: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: RAIL_H,
    backgroundImage: 'repeating-linear-gradient(90deg, #8B6b3a 0px, #8B6b3a 6px, transparent 6px, transparent 18px)',
    backgroundSize: '18px 100%',
  },
};
