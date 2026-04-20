/**
 * Pixel-art sprite data for the Shinkansen train entrance animation.
 *
 * Extracted from Train.jsx to keep the component focused on logic/rendering.
 */

const _ = null;
// Shinkansen E5 series colors
const W = '#e8e8e8'; // white body
const L = '#f5f5f5'; // roof
const B = '#0b7a3b'; // tokiwa-green body (E5's deep green)
const D = '#0a5a2d'; // dark green shadow
const K = '#1e293b'; // windows
const PK = '#e6568c'; // hayabusa pink — the E5's signature stripe
const S = '#b8bec7'; // silver undercarriage
const U = '#6b7380'; // darker silver
const N = '#334155'; // dark
const C = '#78716c'; // connector
const P = '#d4d4d8'; // window frame / panel line
const H = '#fff3b0'; // headlight (warm white)
const G = '#c0c5cc'; // chrome highlight
const Q = '#fde68a'; // warm window-light yellow

// Nose car (E5 Hayabusa "duck-bill"): 16w x 12h
// Long aerodynamic nose pointing left (column 0 = tip). Pink stripe between
// the white upper body and the green lower body is the E5's signature accent.
// Chassis rows 7–11 (S, U, K, N) align pixel-for-pixel with MID.
export const NOSE = [
  [_,_,_,_,_,_,_,_,_,_,_,_,_,L,L,L],
  [_,_,_,_,_,_,_,_,_,_,_,_,L,W,G,W],
  [_,_,_,_,_,_,_,_,_,_,_,L,W,W,W,W],
  [_,_,_,_,_,_,_,_,_,_,W,W,P,K,Q,K],
  [_,_,_,_,_,_,_,_,_,W,W,W,W,W,W,W],
  [_,_,_,_,_,_,_,_,PK,PK,PK,PK,PK,PK,PK,PK],
  [_,_,_,_,_,_,_,B,B,B,B,B,B,B,B,B],
  [_,_,_,H,H,D,D,D,D,D,D,D,D,D,D,D],
  [_,_,_,_,U,U,U,U,U,U,U,U,U,U,U,U],
  [_,_,_,_,_,K,K,_,_,K,K,_,_,K,K,_],
  [_,_,_,_,_,N,N,_,_,N,N,_,_,N,N,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
];

// Middle passenger car: 24w x 12h
// The pink stripe (row 4) separates the white upper body from the green
// lower body — E5's defining livery. Windows (row 3) carry Q (warm yellow
// interior glow) so the cars read as "passenger car at dusk" rather than a
// flat dark band. Two door columns per car (N) break up the green.
export const MID = [
  [C,L,L,L,L,L,L,L,L,L,L,L,L,L,L,L,L,L,L,L,L,L,L,C],
  [C,W,W,W,W,W,W,W,W,W,W,W,G,G,W,W,W,W,W,W,W,W,W,C],
  [C,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,C],
  [C,W,K,Q,K,P,K,Q,K,P,K,Q,K,P,K,Q,K,P,K,Q,K,P,W,C],
  [C,PK,PK,PK,PK,PK,PK,PK,PK,PK,PK,PK,PK,PK,PK,PK,PK,PK,PK,PK,PK,PK,PK,C],
  [C,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,C],
  [C,D,D,D,N,N,D,D,D,D,D,D,D,D,D,D,D,D,N,N,D,D,D,C],
  [C,S,S,S,S,S,S,S,S,S,S,S,S,S,S,S,S,S,S,S,S,S,S,C],
  [_,U,U,U,U,U,U,U,U,U,U,U,U,U,U,U,U,U,U,U,U,U,U,_],
  [_,_,K,K,_,_,K,K,_,_,_,_,_,_,K,K,_,_,K,K,_,_,_,_],
  [_,_,N,N,_,_,N,N,_,_,_,_,_,_,N,N,_,_,N,N,_,_,_,_],
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

// Station sign: 18w x 10h — a small "TOKYO" post the train passes during
// the approach beat. Name plate (white with dark border) on a dark pole.
const SB = '#1e293b'; // sign border / pole
const SW = '#f8fafc'; // sign face
const SK = '#0f172a'; // sign text dots
export const STATION_SIGN = [
  [_,_,SB,SB,SB,SB,SB,SB,SB,SB,SB,SB,SB,SB,SB,SB,_,_],
  [_,SB,SW,SW,SW,SW,SW,SW,SW,SW,SW,SW,SW,SW,SW,SW,SB,_],
  [_,SB,SW,SK,SK,SW,SW,SK,SW,SW,SW,SK,SK,SW,SK,SW,SB,_],
  [_,SB,SW,SK,SW,SW,SW,SK,SW,SW,SW,SK,SW,SW,SK,SW,SB,_],
  [_,SB,SW,SK,SW,SW,SW,SK,SW,SW,SW,SK,SW,SW,SK,SW,SB,_],
  [_,SB,SW,SK,SK,SW,SW,SK,SW,SW,SW,SK,SK,SW,SK,SW,SB,_],
  [_,SB,SW,SW,SW,SW,SW,SW,SW,SW,SW,SW,SW,SW,SW,SW,SB,_],
  [_,_,SB,SB,SB,SB,SB,SB,SB,SB,SB,SB,SB,SB,SB,SB,_,_],
  [_,_,_,_,_,_,_,_,SB,SB,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,SB,SB,_,_,_,_,_,_,_,_],
];

// Steam cloud: 6w x 5h — soft off-white puff emitted at the horn beat.
const CL = '#f1f5f9';
const CD = '#cbd5e1';
export const STEAM_CLOUD = [
  [_,CL,CL,CL,CL,_],
  [CL,CL,CD,CL,CL,CL],
  [CL,CD,CL,CL,CD,CL],
  [_,CL,CL,CD,CL,_],
  [_,_,CL,CL,_,_],
];

// Signal lamp: 3w x 5h — small post-side green/red warning lamp that blinks
// as the train approaches. Two frames (green / red) rendered by phase.
const LG = '#22c55e';
const LR = '#ef4444';
const LP = '#1e293b';
export const SIGNAL_LAMP_GREEN = [
  [LP,LP,LP],
  [LP,LG,LP],
  [LP,LG,LP],
  [_,LP,_],
  [_,LP,_],
];
export const SIGNAL_LAMP_RED = [
  [LP,LP,LP],
  [LP,LR,LP],
  [LP,LR,LP],
  [_,LP,_],
  [_,LP,_],
];

// Pantograph: 13w x 5h — diamond-shaped current collector drawn ABOVE the
// roof of mid cars. Centered mast + scissor frame + contact bar.
const PM = '#1e293b';
const PG_ = '#64748b';
export const PANTOGRAPH = [
  [_,_,_,_,_,_,PM,_,_,_,_,_,_],
  [_,_,_,_,PG_,PM,PM,PM,PG_,_,_,_,_],
  [_,_,PG_,PM,PG_,_,PM,_,PG_,PM,PG_,_,_],
  [PM,PM,PM,PM,PM,PM,PM,PM,PM,PM,PM,PM,PM],
  [_,_,_,_,_,_,PM,_,_,_,_,_,_],
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
