import { useMemo } from 'react';
import { spriteToBoxShadow } from '../engine/sprite';

const _ = null;
const W = '#fff';
const Y = '#f5c542';
const R = '#e03030';
const B = '#222';

// 8x7 pixel art chicken
const CHICKEN = [
  [_,_,_,R,R,_,_,_],
  [_,_,W,W,W,W,_,_],
  [_,W,W,B,W,W,W,_],
  [_,W,W,W,W,W,W,_],
  [_,_,W,W,W,W,_,_],
  [_,_,_,Y,Y,_,_,_],
  [_,_,Y,_,_,Y,_,_],
];

const PX = 4;

export default function Chicken() {
  const shadow = useMemo(() => spriteToBoxShadow(CHICKEN, PX), []);

  return (
    <div style={styles.container}>
      <div className="chicken-run" style={styles.chicken}>
        <div style={{ width: 1, height: 1, boxShadow: shadow, position: 'absolute', top: 0, left: 0 }} />
      </div>
    </div>
  );
}

const styles = {
  container: {
    position: 'fixed',
    inset: 0,
    zIndex: 200,
    pointerEvents: 'none',
    overflow: 'hidden',
  },
  chicken: {
    position: 'absolute',
    width: 8 * PX,
    height: 7 * PX,
    animation: 'chickenRun 3s linear forwards',
  },
};
