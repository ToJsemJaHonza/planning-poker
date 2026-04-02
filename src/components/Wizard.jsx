import { useState, useEffect, useMemo, useRef } from 'react';

const _ = null;
const O = '#222';     // outline
const S = '#f0c8a0'; // skin
const P = '#d09868'; // skin shadow
const H = '#4a3020'; // hair dark brown
const W = '#fff';     // white (shirt)
const B = '#2c3e50'; // blazer/suit dark
const T = '#34495e'; // blazer lighter
const R = '#c0392b'; // tie red
const G = '#3498db'; // glasses blue
const K = '#1a1a2e'; // shoes
const L = '#2980b9'; // laptop/pointer
const Y = '#f5c542'; // gold accent
const N = '#95a5a6'; // laptop gray
const Q = '#ecf0f1'; // shirt lighter

// 10w × 14h — Project Manager: neat hair, glasses, blazer, red tie, pointer
const WALK_1 = [
  [_,_,_,H,H,H,H,_,_,_],  // hair top
  [_,_,H,H,H,H,H,H,_,_],  // hair full
  [_,_,H,S,S,S,S,H,_,_],  // forehead
  [_,_,S,G,S,S,G,S,_,_],  // eyes + glasses
  [_,_,S,S,S,P,S,S,_,_],  // nose
  [_,_,_,S,S,S,S,_,_,_],  // chin
  [_,_,B,W,R,R,W,B,_,_],  // collar + tie
  [_,B,B,W,R,R,W,B,B,_],  // upper body
  [_,B,S,B,W,W,B,S,B,_],  // arms + shirt
  [_,_,B,B,R,R,B,B,_,_],  // belt area
  [_,_,B,B,B,B,B,B,_,_],  // pants
  [_,_,_,B,B,B,B,_,_,_],  // pants lower
  [_,_,_,K,_,_,K,_,_,_],  // legs
  [_,_,K,K,_,_,K,K,_,_],  // shoes frame 1
];

const WALK_2 = [
  ...WALK_1.slice(0, 12),
  [_,_,_,K,_,_,K,_,_,_],  // legs
  [_,_,_,K,K,K,K,_,_,_],  // shoes together
];

// "Reveal" pose — holding pointer up, confident stance
const CAST = [
  [_,_,_,H,H,H,H,_,_,_],
  [_,_,H,H,H,H,H,H,_,_],
  [_,_,H,S,S,S,S,H,_,_],
  [_,_,S,Y,S,S,Y,S,_,_],  // glasses glint gold
  [_,_,S,S,S,P,S,S,_,_],
  [_,_,_,S,S,S,S,_,_,_],
  [_,_,B,W,R,R,W,B,L,_],  // pointer raised
  [_,B,B,W,R,R,W,B,L,_],  // pointer
  [_,B,_,B,W,W,B,S,L,_],  // arm up with pointer
  [_,_,B,B,R,R,B,B,Y,_],  // pointer tip gold
  [_,_,B,B,B,B,B,B,_,_],
  [_,_,_,B,B,B,B,_,_,_],
  [_,_,_,K,_,_,K,_,_,_],
  [_,_,K,K,_,_,K,K,_,_],
];

// Thinking — hand on chin, looking up
const THINK = [
  [_,_,_,H,H,H,H,_,_,_],
  [_,_,H,H,H,H,H,H,_,_],
  [_,_,H,S,S,S,S,H,_,_],
  [_,_,S,G,_,_,G,S,_,_],  // eyes looking up
  [_,_,S,S,S,P,S,S,_,_],
  [_,_,_,S,S,S,S,S,_,_],  // hand on chin
  [_,_,B,W,R,R,W,B,_,_],
  [_,B,B,W,R,R,W,B,B,_],
  [_,B,_,B,W,W,B,_,B,_],
  [_,_,B,B,R,R,B,B,_,_],
  [_,_,B,B,B,B,B,B,_,_],
  [_,_,_,B,B,B,B,_,_,_],
  [_,_,_,K,_,_,K,_,_,_],
  [_,_,K,K,_,_,K,K,_,_],
];

const PX = 5;
const COLS = 10;
const ROWS = 14;
const SPRITE_W = COLS * PX;
const SPRITE_H = ROWS * PX;

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

const SPARKLE_DIRS = [
  { dx: -18, dy: -25 }, { dx: 8, dy: -30 }, { dx: 25, dy: -15 },
  { dx: 28, dy: 5 }, { dx: -10, dy: -35 }, { dx: 20, dy: -28 },
  { dx: -22, dy: -10 }, { dx: 12, dy: -38 },
];

export default function Wizard({ isCasting, onCastComplete }) {
  const [walkFrame, setWalkFrame] = useState(0);
  const [showSparkles, setShowSparkles] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const walkRef = useRef(null);
  const castRef = useRef(null);
  const thinkRef = useRef(null);

  useEffect(() => {
    if (isCasting) {
      clearInterval(walkRef.current);
      clearTimeout(thinkRef.current);
      setIsThinking(false);
      return;
    }
    walkRef.current = setInterval(() => setWalkFrame(f => f ^ 1), 500);
    const loop = () => {
      thinkRef.current = setTimeout(() => {
        if (!isCasting) {
          setIsThinking(true);
          setTimeout(() => { setIsThinking(false); loop(); }, 2000 + Math.random() * 1500);
        }
      }, 6000 + Math.random() * 10000);
    };
    loop();
    return () => { clearInterval(walkRef.current); clearTimeout(thinkRef.current); };
  }, [isCasting]);

  useEffect(() => {
    if (!isCasting) return;
    setShowSparkles(true);
    castRef.current = setTimeout(() => { setShowSparkles(false); onCastComplete?.(); }, 1400);
    return () => clearTimeout(castRef.current);
  }, [isCasting, onCastComplete]);

  const sw1 = useMemo(() => spriteToBoxShadow(WALK_1, PX), []);
  const sw2 = useMemo(() => spriteToBoxShadow(WALK_2, PX), []);
  const sc = useMemo(() => spriteToBoxShadow(CAST, PX), []);
  const st = useMemo(() => spriteToBoxShadow(THINK, PX), []);

  const shadow = isCasting ? sc : isThinking ? st : walkFrame ? sw2 : sw1;
  const paused = isCasting || isThinking;

  return (
    <div style={styles.wrap}>
      <div className="wizard-walk" style={{ ...styles.sprite, animationPlayState: paused ? 'paused' : 'running' }}>
        <div style={{ width: 1, height: 1, boxShadow: shadow, position: 'absolute', top: 0, left: 0 }} />
        {isThinking && <div style={styles.bubble}>🤔</div>}
        {showSparkles && SPARKLE_DIRS.map((d, i) => (
          <span key={i} style={{
            ...styles.sparkle,
            '--dx': `${d.dx}px`, '--dy': `${d.dy}px`,
            left: `${8 * PX}px`, top: `${5 * PX}px`,
            animationDelay: `${i * 0.05}s`,
          }}>✦</span>
        ))}
      </div>
    </div>
  );
}

const styles = {
  wrap: { position: 'fixed', inset: 0, zIndex: 50, pointerEvents: 'none', overflow: 'hidden' },
  sprite: { position: 'absolute', width: SPRITE_W, height: SPRITE_H },
  sparkle: {
    position: 'absolute', fontSize: 18, color: '#f5c542', pointerEvents: 'none',
    animation: 'sparkle-burst 1.2s ease-out forwards',
    textShadow: '0 0 8px #f5c542, 0 0 16px #d4a853',
  },
  bubble: {
    position: 'absolute', top: -8, left: SPRITE_W + 2,
    fontSize: 20,
    animation: 'float 1.5s ease-in-out infinite',
  },
};
