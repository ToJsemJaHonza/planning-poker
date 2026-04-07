import { useState, useEffect, useMemo, useRef } from 'react';

const _ = null;
// Shinkansen E5 series colors
const W = '#e8e8e8'; // white body
const L = '#f5f5f5'; // roof
const B = '#16a34a'; // green stripe (E5 is green!)
const D = '#15803d'; // dark green
const K = '#1e293b'; // windows
const R = '#dc2626'; // accent line
const S = '#94a3b8'; // silver undercarriage
const U = '#64748b'; // darker silver
const N = '#334155'; // dark
const C = '#78716c'; // connector
const P = '#d4d4d8'; // panel line
const H = '#f59e0b'; // headlight

// Nose car (aerodynamic): 16w × 12h
const NOSE = [
  [_,_,_,_,_,_,_,_,_,_,_,L,L,L,L,_],
  [_,_,_,_,_,_,_,_,_,_,L,W,W,W,W,L],
  [_,_,_,_,_,_,_,_,_,W,W,W,W,W,W,W],
  [_,_,_,_,_,_,_,_,W,W,K,K,K,P,W,W],
  [_,_,_,_,_,_,R,R,B,B,B,B,B,B,B,B],
  [_,_,_,_,R,R,R,B,B,B,B,B,B,B,B,B],
  [_,_,H,R,R,R,D,D,D,D,D,D,D,D,D,D],
  [_,_,_,R,R,S,S,S,S,S,S,S,S,S,S,S],
  [_,_,_,_,U,U,U,U,U,U,U,U,U,U,U,U],
  [_,_,_,_,_,K,K,_,_,K,K,_,_,K,K,_],
  [_,_,_,_,_,K,K,_,_,K,K,_,_,K,K,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
];

// Middle passenger car: 24w × 12h
const MID = [
  [C,L,L,L,L,L,L,L,L,L,L,L,L,L,L,L,L,L,L,L,L,L,L,C],
  [C,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,C],
  [C,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,C],
  [C,W,K,K,K,P,K,K,K,P,K,K,K,P,K,K,K,P,K,K,K,P,W,C],
  [C,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,C],
  [C,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,C],
  [C,D,D,D,N,N,D,D,D,D,D,D,D,D,D,D,D,D,N,N,D,D,D,C],
  [C,S,S,S,S,S,S,S,S,S,S,S,S,S,S,S,S,S,S,S,S,S,S,C],
  [_,U,U,U,U,U,U,U,U,U,U,U,U,U,U,U,U,U,U,U,U,U,U,_],
  [_,_,K,K,_,_,K,K,_,_,_,_,_,_,K,K,_,_,K,K,_,_,_,_],
  [_,_,K,K,_,_,K,K,_,_,_,_,_,_,K,K,_,_,K,K,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
];

const PX = 4;
const NOSE_W = 16 * PX;
const MID_W = 24 * PX;
const CAR_H = 12 * PX;
const NUM_MID = 3;
// Train: nose + 3 mid + nose(flipped)
const TOTAL_W = NOSE_W + MID_W * NUM_MID + NOSE_W;

const pixel = "'Press Start 2P', monospace";

// Tree: 6w × 8h
const TG = '#22c55e';
const TD = '#16a34a';
const TT = '#78350f';
const TREE = [
  [_,_,TG,TG,_,_],
  [_,TG,TD,TG,TG,_],
  [TG,TD,TG,TG,TD,TG],
  [TG,TG,TD,TG,TG,TG],
  [_,TG,TG,TG,TG,_],
  [_,_,TT,TT,_,_],
  [_,_,TT,TT,_,_],
  [_,_,TT,TT,_,_],
];
const TPX = 3;

function spriteToShadows(grid, px, offX = 0) {
  const s = [];
  for (let y = 0; y < grid.length; y++)
    for (let x = 0; x < grid[y].length; x++) {
      const c = grid[y][x];
      if (c) s.push(`${x * px + offX}px ${y * px}px 0 ${Math.ceil(px / 2)}px ${c}`);
    }
  return s;
}

// Flip sprite horizontally
function flipGrid(grid) {
  return grid.map(row => [...row].reverse());
}

export default function Train({ fromRight, playerName, onPlayerExit }) {
  const [phase, setPhase] = useState('rails');
  const trainRef = useRef(null);

  const trainShadow = useMemo(() => {
    const all = [];
    let x = 0;
    // Front nose
    all.push(...spriteToShadows(NOSE, PX, x)); x += NOSE_W;
    // Middle cars
    for (let i = 0; i < NUM_MID; i++) { all.push(...spriteToShadows(MID, PX, x)); x += MID_W; }
    // Rear nose (flipped)
    all.push(...spriteToShadows(flipGrid(NOSE), PX, x));
    return all.join(',');
  }, []);

  const treeShadow = useMemo(() => spriteToShadows(TREE, TPX).join(','), []);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase('arrive'), 800),
      setTimeout(() => setPhase('stopped'), 3800),
      setTimeout(() => setPhase('bubble'), 4200),
      setTimeout(() => setPhase('exit'), 6500),
      setTimeout(() => {
        setPhase('depart');
        // Keep richardPos — don't clear, he stays visible until syncedEvent ends
        onPlayerExit?.();
      }, 8000),
      setTimeout(() => setPhase('fadeRails'), 10500),
      setTimeout(() => setPhase('done'), 11500),
    ];
    return () => timers.forEach(clearTimeout);
  }, [onPlayerExit]);

  if (phase === 'done') return null;

  const showTrain = !['rails', 'fadeRails', 'done'].includes(phase);
  const railsFading = phase === 'fadeRails';
  const stopX = `calc(50% - ${TOTAL_W / 2}px)`;
  const trees = [40, 140, 280, 420, 560, 700];

  return (
    <div style={styles.container}>
      {/* Trees */}
      {trees.map((tx, i) => (
        <div key={i} style={{
          position: 'absolute', bottom: 18, left: tx, width: 1, height: 1,
          boxShadow: treeShadow, zIndex: 0,
          opacity: railsFading ? 0 : 1, transition: 'opacity 0.8s',
        }} />
      ))}

      {/* Bubble */}
      {(phase === 'bubble' || phase === 'exit') && (
        <div style={styles.bubble}>🚄 {playerName}: Monorepo conductor has arrived 🚄</div>
      )}


      {/* Train */}
      {showTrain && (
        <div
          ref={trainRef}
          style={{
            ...styles.train, width: TOTAL_W,
            transform: fromRight ? 'scaleX(-1)' : 'scaleX(1)',
            ...(phase === 'arrive' ? {
              animation: `trainArrive${fromRight ? 'Right' : 'Left'} 3s ease-out forwards`,
            } : phase === 'depart' ? {
              animation: `trainDepart${fromRight ? 'Right' : 'Left'} 2.5s ease-in forwards`,
            } : { left: stopX }),
          }}
        >
          <div style={{ width: 1, height: 1, boxShadow: trainShadow, position: 'absolute', top: 0, left: 0 }} />
        </div>
      )}

      {/* Rails */}
      <div style={{ ...styles.rails, opacity: railsFading ? 0 : 1, transition: 'opacity 0.8s' }}>
        <div style={styles.ties} />
        <div style={{ ...styles.railLine, top: 2 }} />
        <div style={{ ...styles.railLine, top: 12 }} />
      </div>
    </div>
  );
}

const styles = {
  container: {
    position: 'fixed', bottom: '80px', left: 0, right: 0,
    height: `${CAR_H + 70}px`, zIndex: 180, pointerEvents: 'none',
  },
  train: { position: 'absolute', height: CAR_H, bottom: 16, zIndex: 2 },
  bubble: {
    position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
    background: '#fff', border: '3px solid #dc2626', padding: '8px 16px',
    fontSize: '0.65rem', fontFamily: pixel, color: '#1e293b',
    maxWidth: '80vw', textAlign: 'center', boxShadow: '4px 4px 0 #991b1b', zIndex: 10,
  },
  rails: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 16, zIndex: 1,
  },
  railLine: {
    position: 'absolute', left: 0, right: 0, height: 3, background: '#71717a', borderRadius: 1,
  },
  ties: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 16,
    backgroundImage: 'repeating-linear-gradient(90deg, #78350f 0px, #78350f 8px, transparent 8px, transparent 22px)',
  },
};
