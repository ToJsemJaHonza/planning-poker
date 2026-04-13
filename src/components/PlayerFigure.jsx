import { useMemo } from 'react';
import Crown from './Crown';

const _ = null;
const O = '#222';     // eyes
const K = '#1a1a2e'; // shoes

export function hashName(name) {
  let h = 2166136261;
  for (let i = 0; i < name.length; i++) {
    h = Math.imul(h ^ name.charCodeAt(i), 16777619);
  }
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h = (h ^ (h >>> 16)) >>> 0;
  return h;
}

function pick(hash, shift, options) {
  return options[((hash >> shift) ^ hash) % options.length >>> 0];
}

const HAIR_COLORS = [
  '#3a2518', '#222', '#6b3a1f', '#c0392b', '#d4850a',  // brown, black, auburn, red, ginger
  '#2c3e50', '#f1c40f', '#e67e22', '#8e6040', '#1a1a1a', // dark blue-black, blonde, orange, light brown, jet black
  '#a0522d', '#daa520', '#555', '#b22222',               // sienna, golden, gray, dark red
];
const SKIN_TONES = ['#f0c8a0', '#e8b888', '#c8a070', '#a07848', '#d4aa78'];
const SHIRT_COLORS = ['#2980b9', '#27ae60', '#8e44ad', '#c0392b', '#2c3e50', '#16a085', '#d35400', '#2ecc71', '#e74c3c', '#1abc9c'];
const PANTS_COLORS = ['#2c3e50', '#34495e', '#1a1a2e', '#3d4d5c', '#4a3d2e'];

// Accessories — each one modifies the grid after base is built
const ACCESSORIES = [
  'glasses', 'headphones', 'cap', 'laptop', 'coffee',
  'backpack', 'scarf', 'hoodie', 'watch', 'beard',
  'phone', 'badge', 'tie', 'pen', 'glasses',
];

function generateSprite(name, poseOverride = null) {
  const h = hashName(name);
  const hr = pick(h, 0, HAIR_COLORS);
  const sk = pick(h, 3, SKIN_TONES);
  // P4: if hair luminance is too close to skin, force a high-contrast hair color
  const lum = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    return ((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114;
  };
  let hrFinal = hr;
  if (Math.abs(lum(hrFinal) - lum(sk)) < 40) {
    hrFinal = pick(h, 30, ['#d4850a', '#f1c40f', '#daa520', '#8b4513']);
  }
  const sc = pick(h, 6, SHIRT_COLORS);
  const pc = pick(h, 9, PANTS_COLORS);
  const acc = pick(h, 12, ACCESSORIES);
  // Pose is deterministic-from-name by default; callers can override (e.g.
  // the Crowning Machine swaps the winner to `hips` during the crowning).
  const pose = poseOverride || pick(h, 18, ['neutral', 'hips', 'pockets', 'crossed', 'lean', 'neutral']);
  const haircut = pick(h, 24, [
    'short', 'neat', 'spiky', 'side', 'long', 'curly', 'mohawk', 'buzz', 'parted', 'messy',
  ]);
  const ns = '#c09060';

  // Hair rows based on haircut
  let h0, h1, h2;
  switch (haircut) {
    case 'short':
      h0 = [_,_,_,_,hrFinal,hrFinal,hrFinal,hrFinal,_,_,_,_];
      h1 = [_,_,_,hrFinal,hrFinal,hrFinal,hrFinal,hrFinal,hrFinal,_,_,_];
      h2 = [_,_,_,hrFinal,sk,sk,sk,sk,hrFinal,_,_,_];
      break;
    case 'neat':
      h0 = [_,_,_,hrFinal,hrFinal,hrFinal,hrFinal,hrFinal,_,_,_,_];
      h1 = [_,_,_,hrFinal,hrFinal,hrFinal,hrFinal,hrFinal,hrFinal,_,_,_];
      h2 = [_,_,_,hrFinal,sk,sk,sk,sk,hrFinal,_,_,_];
      break;
    case 'spiky':
      h0 = [_,_,_,hrFinal,_,hrFinal,_,hrFinal,_,_,_,_];
      h1 = [_,_,_,hrFinal,hrFinal,hrFinal,hrFinal,hrFinal,hrFinal,_,_,_];
      h2 = [_,_,_,hrFinal,sk,sk,sk,sk,hrFinal,_,_,_];
      break;
    case 'side':
      h0 = [_,_,_,_,_,hrFinal,hrFinal,hrFinal,hrFinal,_,_,_];
      h1 = [_,_,_,_,hrFinal,hrFinal,hrFinal,hrFinal,hrFinal,hrFinal,_,_];
      h2 = [_,_,_,hrFinal,sk,sk,sk,sk,hrFinal,_,_,_];
      break;
    case 'long':
      h0 = [_,_,_,hrFinal,hrFinal,hrFinal,hrFinal,hrFinal,hrFinal,_,_,_];
      h1 = [_,_,hrFinal,hrFinal,hrFinal,hrFinal,hrFinal,hrFinal,hrFinal,hrFinal,_,_];
      h2 = [_,_,hrFinal,hrFinal,sk,sk,sk,sk,hrFinal,hrFinal,_,_];
      break;
    case 'curly':
      h0 = [_,_,hrFinal,hrFinal,hrFinal,hrFinal,hrFinal,hrFinal,hrFinal,_,_,_];
      h1 = [_,_,hrFinal,hrFinal,hrFinal,hrFinal,hrFinal,hrFinal,hrFinal,hrFinal,_,_];
      h2 = [_,_,hrFinal,hrFinal,sk,sk,sk,sk,hrFinal,hrFinal,_,_];
      break;
    case 'mohawk':
      h0 = [_,_,_,_,_,hrFinal,hrFinal,_,_,_,_,_];
      h1 = [_,_,_,_,hrFinal,hrFinal,hrFinal,hrFinal,_,_,_,_];
      h2 = [_,_,_,hrFinal,sk,sk,sk,sk,hrFinal,_,_,_];
      break;
    case 'buzz':
      h0 = [_,_,_,_,_,_,_,_,_,_,_,_];
      h1 = [_,_,_,_,hrFinal,hrFinal,hrFinal,hrFinal,_,_,_,_];
      h2 = [_,_,_,hrFinal,sk,sk,sk,sk,hrFinal,_,_,_];
      break;
    case 'parted':
      h0 = [_,_,_,hrFinal,hrFinal,_,hrFinal,hrFinal,hrFinal,_,_,_];
      h1 = [_,_,_,hrFinal,hrFinal,hrFinal,hrFinal,hrFinal,hrFinal,_,_,_];
      h2 = [_,_,_,hrFinal,sk,sk,sk,sk,hrFinal,_,_,_];
      break;
    case 'messy':
    default:
      h0 = [_,_,hrFinal,_,hrFinal,hrFinal,hrFinal,_,hrFinal,_,_,_];
      h1 = [_,_,_,hrFinal,hrFinal,hrFinal,hrFinal,hrFinal,hrFinal,_,_,_];
      h2 = [_,_,_,hrFinal,sk,sk,sk,sk,hrFinal,_,_,_];
      break;
  }

  // Base grid: 12w × 14h
  const grid = [
    h0,                                                   // 0: hair top
    h1,                                                   // 1: hair
    h2,                                                   // 2: forehead
    [_,_,_,sk,O,sk,sk,O,sk,_,_,_],   // 3: eyes
    [_,_,_,sk,sk,sk,ns,sk,sk,_,_,_],  // 4: nose
    [_,_,_,_,sk,sk,sk,sk,_,_,_,_],   // 5: chin
    [_,_,_,sc,sc,sc,sc,sc,sc,_,_,_],  // 6: collar
    [_,_,sc,sc,sc,sc,sc,sc,sc,sc,_,_], // 7: upper body
    [_,_,sc,sk,sc,sc,sc,sc,sk,sc,_,_], // 8: arms
    [_,_,_,sc,sc,sc,sc,sc,sc,_,_,_],  // 9: lower shirt
    [_,_,_,pc,pc,pc,pc,pc,pc,_,_,_],  // 10: pants
    [_,_,_,_,pc,pc,_,pc,pc,_,_,_],   // 11: legs
    [_,_,_,_,K,K,_,_,K,K,_,_],       // 12: shoes
    [_,_,_,K,K,_,_,_,_,K,K,_],       // 13: shoe tips
  ];

  // Apply pose variations
  if (pose === 'hips') {
    // Hands on hips — confident
    grid[8] = [_,_,sk,sc,sc,sc,sc,sc,sc,sk,_,_];
    grid[9] = [_,_,sk,sc,sc,sc,sc,sc,sc,sk,_,_];
  }

  if (pose === 'pockets') {
    // Hands in pockets — casual
    grid[8] = [_,_,sc,sc,sc,sc,sc,sc,sc,sc,_,_];
    grid[9] = [_,_,_,sc,sc,sc,sc,sc,sc,_,_,_];
    grid[10] = [_,_,_,pc,sk,pc,pc,sk,pc,_,_,_];
  }

  if (pose === 'crossed') {
    // Arms crossed
    grid[8] = [_,_,sc,sc,sk,sk,sk,sk,sc,sc,_,_];
    grid[9] = [_,_,_,sc,sk,sc,sc,sk,sc,_,_,_];
  }

  if (pose === 'lean') {
    // Leaning slightly — relaxed upper body
    grid[7] = [_,_,sc,sc,sc,sc,sc,sc,sc,sc,_,_];
    grid[8] = [_,_,sc,sk,sc,sc,sc,sc,sk,sc,_,_];
  }

  // Apply leg stance (independent from upper body pose)
  const stance = pick(h, 21, ['together', 'apart', 'crossed', 'casual', 'wide', 'together']);

  if (stance === 'together') {
    // Feet together — standing straight
    grid[11] = [_,_,_,_,pc,pc,pc,pc,_,_,_,_];
    grid[12] = [_,_,_,_,K,K,K,K,_,_,_,_];
    grid[13] = [_,_,_,K,K,K,K,K,K,_,_,_];
  }

  if (stance === 'apart') {
    // Legs apart — stable stance
    grid[11] = [_,_,_,pc,pc,_,_,pc,pc,_,_,_];
    grid[12] = [_,_,_,K,K,_,_,_,K,K,_,_];
    grid[13] = [_,_,K,K,_,_,_,_,_,K,K,_];
  }

  if (stance === 'crossed') {
    // Legs crossed — casual lean
    grid[11] = [_,_,_,_,pc,pc,pc,pc,_,_,_,_];
    grid[12] = [_,_,_,_,_,K,K,_,_,_,_,_];
    grid[13] = [_,_,_,_,K,K,K,K,_,_,_,_];
  }

  if (stance === 'casual') {
    // One leg slightly forward
    grid[11] = [_,_,_,pc,pc,_,_,pc,pc,_,_,_];
    grid[12] = [_,_,K,K,_,_,_,_,K,K,_,_];
    grid[13] = [_,_,K,K,_,_,_,_,K,K,_,_];
  }

  if (stance === 'wide') {
    // Wide power stance
    grid[11] = [_,_,pc,pc,_,_,_,_,pc,pc,_,_];
    grid[12] = [_,_,K,K,_,_,_,_,_,K,K,_];
    grid[13] = [_,K,K,_,_,_,_,_,_,_,K,K];
  }

  // Apply accessories
  if (acc === 'glasses') {
    const gl = '#4a90d9';
    grid[3] = [_,_,_,sk,gl,O,sk,gl,O,_,_,_];
  }

  if (acc === 'headphones') {
    const hp = '#555';
    grid[0][2] = hp;
    grid[0][9] = hp;
    grid[1][2] = hp;
    grid[1][9] = hp;
    grid[2][2] = hp;
    grid[2][9] = hp;
  }

  if (acc === 'cap') {
    const cp = pick(h, 18, ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6']);
    grid[0] = [_,_,_,cp,cp,cp,cp,cp,cp,_,_,_];
    grid[1] = [_,_,cp,cp,cp,cp,cp,cp,cp,cp,_,_];
    // cap brim
    grid[2] = [_,_,cp,cp,cp,sk,sk,sk,sk,cp,_,_];
  }

  if (acc === 'laptop') {
    const lp = '#777';
    const ls = '#aaddff';
    // laptop in left hand
    grid[8] = [_,lp,lp,sk,sc,sc,sc,sc,sk,sc,_,_];
    grid[9] = [_,ls,lp,sc,sc,sc,sc,sc,sc,_,_,_];
  }

  if (acc === 'coffee') {
    const cf = '#f5f0e0'; // cup
    const cw = '#8b5a2b'; // coffee brown
    // coffee cup in right hand
    grid[7] = [_,_,sc,sc,sc,sc,sc,sc,sc,sc,cf,_];
    grid[8] = [_,_,sc,sk,sc,sc,sc,sc,sk,cf,cw,_];
    grid[9] = [_,_,_,sc,sc,sc,sc,sc,sc,cf,_,_];
  }

  if (acc === 'backpack') {
    const bp = '#e67e22';
    // backpack behind (visible on right side)
    grid[6][9] = bp;
    grid[7][10] = bp;
    grid[8][10] = bp;
    grid[9][10] = bp;
    grid[10][9] = bp;
  }

  if (acc === 'scarf') {
    const sf = pick(h, 20, ['#e74c3c', '#f39c12', '#3498db', '#2ecc71']);
    grid[5] = [_,_,_,_,sf,sf,sf,sf,_,_,_,_];
    grid[6] = [_,_,_,sf,sf,sc,sc,sf,sf,sf,_,_];
  }

  if (acc === 'hoodie') {
    // hoodie over shirt — hood behind head
    const hd = pick(h, 20, ['#555', '#7f8c8d', '#2c3e50', '#8e44ad']);
    grid[0][3] = hd; grid[0][8] = hd;
    grid[1][2] = hd; grid[1][9] = hd;
    grid[6] = [_,_,_,hd,hd,sc,sc,hd,hd,_,_,_];
    grid[7] = [_,_,hd,hd,sc,sc,sc,sc,hd,hd,_,_];
  }

  if (acc === 'watch') {
    // watch on left wrist
    const wt = '#f5c542';
    grid[8][3] = wt;
    grid[9][3] = wt;
  }

  if (acc === 'beard') {
    const bd = pick(h, 20, ['#888', '#666', '#4a3020', '#6b3a1f']);
    grid[5] = [_,_,_,_,bd,bd,bd,bd,_,_,_,_];
    grid[6] = [_,_,_,sc,bd,bd,bd,bd,sc,_,_,_];
  }

  if (acc === 'phone') {
    // phone in right hand
    const ph = '#333';
    const ps = '#5599dd';
    grid[7] = [_,_,sc,sc,sc,sc,sc,sc,sc,sc,ph,_];
    grid[8] = [_,_,sc,sk,sc,sc,sc,sc,sk,ph,ps,_];
    grid[9] = [_,_,_,sc,sc,sc,sc,sc,sc,ph,_,_];
  }

  if (acc === 'badge') {
    // ID badge on chest
    const bg = '#fff';
    const bl = '#3498db';
    grid[7] = [_,_,sc,sc,sc,bg,bl,sc,sc,sc,_,_];
  }

  if (acc === 'tie') {
    // necktie
    const ti = pick(h, 20, ['#c0392b', '#2980b9', '#f39c12', '#8e44ad']);
    grid[6] = [_,_,_,sc,sc,ti,ti,sc,sc,_,_,_];
    grid[7] = [_,_,sc,sc,sc,ti,ti,sc,sc,sc,_,_];
    grid[8] = [_,_,sc,sk,sc,ti,sc,sc,sk,sc,_,_];
    grid[9] = [_,_,_,sc,sc,ti,sc,sc,sc,_,_,_];
  }

  if (acc === 'pen') {
    // pen behind ear + in pocket
    const pn = '#222';
    const pt = '#c0392b';
    grid[1][9] = pn;
    grid[2][9] = pn;
    grid[7] = [_,_,sc,sc,sc,sc,sc,sc,pn,sc,_,_];
    grid[8] = [_,_,sc,sk,sc,sc,sc,sc,sk,pt,_,_];
  }

  return grid;
}

const PX = 5;
const COLS = 12;
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

// Subtle two-frame walk cycle matching the PM (Wizard) style: only the
// bottom three rows (pants hem + legs + shoes) change between frames.
// Both frames are intentionally chosen so they don't coincide with ANY
// idle leg stance, guaranteeing every player visibly animates.
function applyWalkFrame(grid, pc, sk, sc, frame) {
  const K = '#1a1a2e';
  if (frame === 0) {
    // Feet split wide with a visible gap
    grid[11] = [_,_,_,pc,pc,_,_,pc,pc,_,_,_];
    grid[12] = [_,_,_,K,_,_,_,_,_,K,_,_];
    grid[13] = [_,_,K,K,_,_,_,_,_,K,K,_];
  } else {
    // Feet lifted close to center, toe line planted
    grid[11] = [_,_,_,_,pc,pc,pc,pc,_,_,_,_];
    grid[12] = [_,_,_,_,_,K,K,_,_,_,_,_];
    grid[13] = [_,_,_,K,K,K,K,K,K,_,_,_];
  }
  return grid;
}

/**
 * Pure helper: compute the final box-shadow string for a given player /
 * pose / walk frame. Exported for tests so we don't have to go through
 * React render + DOM introspection (jsdom strips very long CSS values).
 */
export function computePlayerShadow(
  name,
  { holdingCard = false, fukEyes = false, walkFrame = null, pose = null } = {}
) {
  if (fukEyes) {
    const h = hashName(name || 'default');
    const hr = pick(h, 0, HAIR_COLORS);
    const sk = pick(h, 3, SKIN_TONES);
    const ns = '#c09060';
    const hasGlasses = (h >> 12) % 3 === 0;
    const e4 = hasGlasses ? '#4a90d9' : O;
    const empty = [_,_,_,_,_,_,_,_,_,_,_,_];
    const grid = [
      empty, empty, empty, empty, empty, empty, empty, empty, empty,
      [_,_,_,_,hr,hr,hr,hr,_,_,_,_],
      [_,_,_,hr,hr,hr,hr,hr,hr,_,_,_],
      [_,_,_,hr,sk,sk,sk,sk,hr,_,_,_],
      [_,_,_,sk,e4,sk,sk,e4,sk,_,_,_],
      [_,_,_,sk,sk,sk,ns,sk,sk,_,_,_],
    ];
    return spriteToBoxShadow(grid, PX);
  }

  const grid = generateSprite(name || 'default', pose);

  if (holdingCard) {
    const h = hashName(name || 'default');
    const sk = pick(h, 3, SKIN_TONES);
    const sc = pick(h, 6, SHIRT_COLORS);
    grid[7] = [_,_,sc,sc,sc,sc,sc,sc,sc,sk,sk,_];
    grid[8] = [_,_,sc,sk,sc,sc,sc,sc,sc,sc,sk,_];
  }

  if (walkFrame === 0 || walkFrame === 1) {
    const h = hashName(name || 'default');
    const sk = pick(h, 3, SKIN_TONES);
    const pc = pick(h, 9, PANTS_COLORS);
    const sc = pick(h, 6, SHIRT_COLORS);
    applyWalkFrame(grid, pc, sk, sc, walkFrame);
  }

  return spriteToBoxShadow(grid, PX);
}

export default function PlayerFigure({ name, holdingCard, fukEyes, walkFrame = null, pose = null, showCrown = false }) {
  const shadow = useMemo(
    () => computePlayerShadow(name, { holdingCard, fukEyes, walkFrame, pose }),
    [name, holdingCard, fukEyes, walkFrame, pose]
  );

  return (
    <div style={{ width: SPRITE_W, height: SPRITE_H, position: 'relative' }}>
      <div style={{
        width: 1, height: 1,
        boxShadow: shadow,
        position: 'absolute',
        top: 0, left: 0,
      }} />
      {/* iter 2: Crown sprite on player-leader's head. Positioned at the
          design doc v2 §2 head anchor offset. Crown is a child of the figure
          wrapper so it bobs/walks with the figure. Z-index 1 = below voting
          card (z-index 2). */}
      {showCrown && <Crown anchorMode="head" />}
    </div>
  );
}

export { SPRITE_W, SPRITE_H };
