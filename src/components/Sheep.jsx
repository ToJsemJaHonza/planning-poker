import { useMemo } from 'react';

const _ = null;
const W = '#f0f0f0'; // wool white
const C = '#ddd';     // wool shadow
const B = '#222';     // face/legs black
const P = '#ffb6c1'; // pink nose/ears
const E = '#111';     // eyes

// 10×8 pixel art sheep
const SHEEP = [
  [_,_,W,W,W,W,W,W,_,_],
  [_,W,C,W,W,W,C,W,W,_],
  [_,W,W,W,W,W,W,W,W,_],
  [B,B,B,W,W,W,W,W,W,_],
  [B,E,B,P,W,W,W,W,W,_],
  [B,B,B,W,W,W,W,W,W,_],
  [_,_,B,_,B,_,_,B,_,B],
  [_,_,B,_,B,_,_,B,_,B],
];

const PX = 5;

function spriteToBoxShadow(grid, px) {
  const shadows = [];
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      const c = grid[y][x];
      if (c) shadows.push(`${x * px}px ${y * px}px 0 ${Math.ceil(px / 2)}px ${c}`);
    }
  }
  return shadows.join(',');
}

export default function Sheep() {
  const shadow = useMemo(() => spriteToBoxShadow(SHEEP, PX), []);

  return (
    <div style={styles.container}>
      {/* The text */}
      <div className="sheep-text" style={styles.text}>
        OKTAAAAAAAAAAAAAAA!!!!
      </div>
      {/* The sheep */}
      <div className="sheep-run" style={styles.sheep}>
        <div style={{ width: 1, height: 1, boxShadow: shadow, position: 'absolute', top: 0, left: 0 }} />
      </div>
    </div>
  );
}

const pixel = "'Press Start 2P', monospace";

const styles = {
  container: {
    position: 'fixed',
    inset: 0,
    zIndex: 250,
    pointerEvents: 'none',
    overflow: 'hidden',
  },
  sheep: {
    position: 'absolute',
    width: 10 * PX,
    height: 8 * PX,
    animation: 'sheepRun 4s linear forwards',
  },
  text: {
    position: 'absolute',
    top: '35%',
    left: '-100%',
    fontSize: '2rem',
    fontFamily: pixel,
    color: '#e03030',
    textShadow: '3px 3px 0 #222',
    whiteSpace: 'nowrap',
    animation: 'sheepTextRun 4s linear forwards',
  },
};
