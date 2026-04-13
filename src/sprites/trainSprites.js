/**
 * Pixel-art sprite data for the Shinkansen train entrance animation.
 *
 * Extracted from Train.jsx to keep the component focused on logic/rendering.
 */

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

// Nose car (aerodynamic): 16w x 12h
export const NOSE = [
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

// Middle passenger car: 24w x 12h
export const MID = [
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

// Tree: 6w x 8h
const TG = '#22c55e';
const TD = '#16a34a';
const TT = '#78350f';
export const TREE = [
  [_,_,TG,TG,_,_],
  [_,TG,TD,TG,TG,_],
  [TG,TD,TG,TG,TD,TG],
  [TG,TG,TD,TG,TG,TG],
  [_,TG,TG,TG,TG,_],
  [_,_,TT,TT,_,_],
  [_,_,TT,TT,_,_],
  [_,_,TT,TT,_,_],
];

export const PX = 4;
export const TPX = 3;
export const NOSE_W = 16 * PX;
export const MID_W = 24 * PX;
export const CAR_H = 12 * PX;
export const NUM_MID = 3;
// Train: nose + 3 mid + nose(flipped)
export const TOTAL_W = NOSE_W + MID_W * NUM_MID + NOSE_W;

export function spriteToShadows(grid, px, offX = 0) {
  const s = [];
  for (let y = 0; y < grid.length; y++)
    for (let x = 0; x < grid[y].length; x++) {
      const c = grid[y][x];
      if (c) s.push(`${x * px + offX}px ${y * px}px 0 ${Math.ceil(px / 2)}px ${c}`);
    }
  return s;
}

// Flip sprite horizontally
export function flipGrid(grid) {
  return grid.map(row => [...row].reverse());
}
