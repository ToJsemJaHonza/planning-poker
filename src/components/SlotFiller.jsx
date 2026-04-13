import { useMemo } from 'react';
import { spriteToBoxShadow, PX, SPRITE_PIXEL_STYLE } from '../engine/sprite';

const _ = null;

// Palette -- matches the cabinet color scheme.
const OUT = '#0a0b11';       // cabinet outline
const GOLD_B = '#f5c542';     // gold bright
const GOLD_P = '#d4a853';     // gold primary
const GOLD_S = '#b8922e';     // gold shadow
const NAVY = '#2c3e6b';       // cabinet body
const PARCHMENT = '#f5f0e4';  // slot parchment
const RED = '#c0392b';        // near-miss red
const CREAM = '#e8e8e8';      // off-white
const TAN = '#f5f0e0';        // coffee cup
const COFFEE_DARK = '#8b5a2b';// coffee brown
const PURPLE = '#5b2a8c';     // wizard hat
const CYAN = '#5599dd';       // PR accent
const GRAY_L = '#95a5a6';     // CRT gray
const GREEN = '#16a34a';      // git green
const CHEESE = '#f5c542';     // pizza cheese
const TOMATO = '#c0392b';     // pizza sauce
const CRUST = '#d4850a';      // pizza crust

const COLS = 12;
const ROWS = 14;

// ---------------------------------------------------------------------------
// Sprite grids — one per filler variant
// ---------------------------------------------------------------------------

const CROWN_GRID = [
  [_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,GOLD_B,_,GOLD_B,_,_,GOLD_B,_,GOLD_B,_,_],
  [_,_,GOLD_B,GOLD_B,GOLD_B,GOLD_B,GOLD_B,GOLD_B,GOLD_B,GOLD_B,_,_],
  [_,_,GOLD_B,GOLD_B,GOLD_B,GOLD_B,GOLD_B,GOLD_B,GOLD_B,GOLD_B,_,_],
  [_,_,GOLD_P,GOLD_P,GOLD_P,GOLD_P,GOLD_P,GOLD_P,GOLD_P,GOLD_P,_,_],
  [_,_,GOLD_P,RED,GOLD_P,RED,GOLD_P,RED,GOLD_P,GOLD_P,_,_],
  [_,_,GOLD_P,GOLD_P,GOLD_P,GOLD_P,GOLD_P,GOLD_P,GOLD_P,GOLD_P,_,_],
  [_,_,OUT,OUT,OUT,OUT,OUT,OUT,OUT,OUT,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_],
];

const TROPHY_GRID = [
  [_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,GOLD_B,GOLD_B,GOLD_B,GOLD_B,GOLD_B,GOLD_B,_,_,_],
  [_,_,GOLD_P,GOLD_P,GOLD_P,GOLD_P,GOLD_P,GOLD_P,GOLD_P,GOLD_P,_,_],
  [_,GOLD_P,GOLD_P,GOLD_P,GOLD_P,GOLD_P,GOLD_P,GOLD_P,GOLD_P,GOLD_P,GOLD_P,_],
  [GOLD_P,GOLD_P,GOLD_P,GOLD_P,GOLD_P,GOLD_P,GOLD_P,GOLD_P,GOLD_P,GOLD_P,GOLD_P,GOLD_P],
  [GOLD_P,GOLD_P,GOLD_S,GOLD_P,GOLD_P,GOLD_P,GOLD_P,GOLD_P,GOLD_P,GOLD_S,GOLD_P,GOLD_P],
  [_,GOLD_S,GOLD_P,GOLD_P,GOLD_P,GOLD_P,GOLD_P,GOLD_P,GOLD_P,GOLD_P,GOLD_S,_],
  [_,_,GOLD_S,GOLD_P,GOLD_P,GOLD_P,GOLD_P,GOLD_P,GOLD_P,GOLD_S,_,_],
  [_,_,_,GOLD_S,GOLD_P,GOLD_P,GOLD_P,GOLD_P,GOLD_S,_,_,_],
  [_,_,_,_,GOLD_P,GOLD_P,GOLD_P,GOLD_P,_,_,_,_],
  [_,_,_,GOLD_P,GOLD_P,GOLD_P,GOLD_P,GOLD_P,GOLD_P,_,_,_],
  [_,_,GOLD_P,GOLD_P,GOLD_P,GOLD_P,GOLD_P,GOLD_P,GOLD_P,GOLD_P,_,_],
  [_,OUT,OUT,OUT,OUT,OUT,OUT,OUT,OUT,OUT,OUT,_],
  [_,_,_,_,_,_,_,_,_,_,_,_],
];

const COFFEE_GRID = [
  [_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,CREAM,_,CREAM,_,CREAM,_,_,_],
  [_,_,_,_,_,CREAM,_,CREAM,_,_,_,_],
  [_,_,TAN,TAN,TAN,TAN,TAN,TAN,TAN,TAN,_,_],
  [_,_,TAN,COFFEE_DARK,COFFEE_DARK,COFFEE_DARK,COFFEE_DARK,COFFEE_DARK,COFFEE_DARK,TAN,TAN,_],
  [_,_,TAN,COFFEE_DARK,COFFEE_DARK,COFFEE_DARK,COFFEE_DARK,COFFEE_DARK,COFFEE_DARK,TAN,TAN,TAN],
  [_,_,TAN,TAN,TAN,TAN,TAN,TAN,TAN,TAN,TAN,TAN],
  [_,_,TAN,TAN,TAN,TAN,TAN,TAN,TAN,TAN,TAN,_],
  [_,_,TAN,TAN,TAN,TAN,TAN,TAN,TAN,TAN,_,_],
  [_,_,_,TAN,TAN,TAN,TAN,TAN,TAN,_,_,_],
  [_,_,_,_,TAN,TAN,TAN,TAN,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_],
];

const PULL_REQUEST_GRID = [
  [_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,OUT,OUT,OUT,OUT,OUT,OUT,OUT,OUT,_,_],
  [_,_,OUT,GREEN,GREEN,GREEN,GREEN,GREEN,GREEN,OUT,_,_],
  [_,_,OUT,GREEN,CYAN,CYAN,CYAN,CYAN,GREEN,OUT,_,_],
  [_,_,OUT,GREEN,CYAN,GOLD_B,GOLD_B,CYAN,GREEN,OUT,_,_],
  [_,_,OUT,GREEN,CYAN,GOLD_B,GOLD_B,CYAN,GREEN,OUT,_,_],
  [_,_,OUT,GREEN,CYAN,CYAN,CYAN,CYAN,GREEN,OUT,_,_],
  [_,_,OUT,GREEN,GREEN,GREEN,GREEN,GREEN,GREEN,OUT,_,_],
  [_,_,OUT,OUT,OUT,OUT,OUT,OUT,OUT,OUT,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_],
];

const QUESTION_MARK_GRID = [
  [_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,OUT,OUT,OUT,OUT,OUT,OUT,OUT,OUT,_,_],
  [_,_,OUT,NAVY,NAVY,NAVY,NAVY,NAVY,NAVY,OUT,_,_],
  [_,_,OUT,NAVY,GOLD_B,GOLD_B,GOLD_B,NAVY,NAVY,OUT,_,_],
  [_,_,OUT,NAVY,GOLD_B,NAVY,GOLD_B,NAVY,NAVY,OUT,_,_],
  [_,_,OUT,NAVY,NAVY,NAVY,GOLD_B,NAVY,NAVY,OUT,_,_],
  [_,_,OUT,NAVY,NAVY,GOLD_B,NAVY,NAVY,NAVY,OUT,_,_],
  [_,_,OUT,NAVY,NAVY,GOLD_B,NAVY,NAVY,NAVY,OUT,_,_],
  [_,_,OUT,NAVY,NAVY,NAVY,NAVY,NAVY,NAVY,OUT,_,_],
  [_,_,OUT,NAVY,NAVY,GOLD_B,NAVY,NAVY,NAVY,OUT,_,_],
  [_,_,OUT,NAVY,NAVY,NAVY,NAVY,NAVY,NAVY,OUT,_,_],
  [_,_,OUT,OUT,OUT,OUT,OUT,OUT,OUT,OUT,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_],
];

const CONTINUE_GRID = [
  [_,_,_,_,_,_,_,_,_,_,_,_],
  [_,OUT,OUT,OUT,OUT,OUT,OUT,OUT,OUT,OUT,OUT,_],
  [_,OUT,GRAY_L,GRAY_L,GRAY_L,GRAY_L,GRAY_L,GRAY_L,GRAY_L,GRAY_L,OUT,_],
  [_,OUT,GRAY_L,OUT,OUT,OUT,OUT,OUT,OUT,GRAY_L,OUT,_],
  [_,OUT,GRAY_L,OUT,GOLD_B,_,_,GOLD_B,OUT,GRAY_L,OUT,_],
  [_,OUT,GRAY_L,OUT,GOLD_B,GOLD_B,GOLD_B,GOLD_B,OUT,GRAY_L,OUT,_],
  [_,OUT,GRAY_L,OUT,GOLD_B,_,_,GOLD_B,OUT,GRAY_L,OUT,_],
  [_,OUT,GRAY_L,OUT,OUT,OUT,OUT,OUT,OUT,GRAY_L,OUT,_],
  [_,OUT,GRAY_L,_,GOLD_B,_,GOLD_B,_,GOLD_B,GRAY_L,OUT,_],
  [_,OUT,GRAY_L,GRAY_L,GRAY_L,GRAY_L,GRAY_L,GRAY_L,GRAY_L,GRAY_L,OUT,_],
  [_,OUT,OUT,OUT,OUT,OUT,OUT,OUT,OUT,OUT,OUT,_],
  [_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_],
];

const PIZZA_GRID = [
  [_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,CRUST,CRUST,_,_,_,_,_],
  [_,_,_,_,CRUST,TOMATO,TOMATO,CRUST,_,_,_,_],
  [_,_,_,CRUST,TOMATO,CHEESE,CHEESE,TOMATO,CRUST,_,_,_],
  [_,_,_,CRUST,TOMATO,TOMATO,CHEESE,TOMATO,CRUST,_,_,_],
  [_,_,CRUST,TOMATO,CHEESE,TOMATO,TOMATO,CHEESE,TOMATO,CRUST,_,_],
  [_,_,CRUST,TOMATO,TOMATO,RED,TOMATO,TOMATO,TOMATO,CRUST,_,_],
  [_,CRUST,TOMATO,CHEESE,TOMATO,TOMATO,TOMATO,CHEESE,TOMATO,TOMATO,CRUST,_],
  [_,CRUST,TOMATO,TOMATO,RED,TOMATO,TOMATO,TOMATO,RED,TOMATO,CRUST,_],
  [CRUST,TOMATO,TOMATO,TOMATO,TOMATO,CHEESE,TOMATO,TOMATO,TOMATO,TOMATO,TOMATO,CRUST],
  [CRUST,CRUST,CRUST,CRUST,CRUST,CRUST,CRUST,CRUST,CRUST,CRUST,CRUST,CRUST],
  [_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_],
];

const WIZARD_HAT_GRID = [
  [_,_,_,_,_,_,GOLD_B,_,_,_,_,_],
  [_,_,_,_,_,PURPLE,PURPLE,_,_,_,_,_],
  [_,_,_,_,PURPLE,PURPLE,PURPLE,_,_,_,_,_],
  [_,_,_,PURPLE,PURPLE,PURPLE,PURPLE,GOLD_B,_,_,_,_],
  [_,_,_,PURPLE,PURPLE,PURPLE,PURPLE,PURPLE,_,_,_,_],
  [_,_,PURPLE,PURPLE,PURPLE,PURPLE,PURPLE,PURPLE,PURPLE,_,_,_],
  [_,_,PURPLE,PURPLE,GOLD_B,PURPLE,PURPLE,PURPLE,PURPLE,_,_,_],
  [_,PURPLE,PURPLE,PURPLE,PURPLE,PURPLE,PURPLE,PURPLE,PURPLE,PURPLE,_,_],
  [_,PURPLE,PURPLE,PURPLE,PURPLE,PURPLE,PURPLE,PURPLE,PURPLE,PURPLE,_,_],
  [PURPLE,PURPLE,PURPLE,PURPLE,PURPLE,PURPLE,PURPLE,PURPLE,PURPLE,PURPLE,PURPLE,_],
  [GOLD_P,GOLD_P,GOLD_P,GOLD_P,GOLD_P,GOLD_P,GOLD_P,GOLD_P,GOLD_P,GOLD_P,GOLD_P,_],
  [OUT,OUT,OUT,OUT,OUT,OUT,OUT,OUT,OUT,OUT,OUT,_],
  [_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_],
];

// "404 PM NOT FOUND" filler — compact pixel word art.
const NOT_FOUND_GRID = [
  [_,_,_,_,_,_,_,_,_,_,_,_],
  [_,OUT,OUT,OUT,OUT,OUT,OUT,OUT,OUT,OUT,OUT,_],
  [_,OUT,NAVY,NAVY,NAVY,NAVY,NAVY,NAVY,NAVY,NAVY,OUT,_],
  [_,OUT,NAVY,GOLD_B,_,GOLD_B,_,GOLD_B,NAVY,NAVY,OUT,_],
  [_,OUT,NAVY,GOLD_B,GOLD_B,GOLD_B,GOLD_B,GOLD_B,NAVY,NAVY,OUT,_],
  [_,OUT,NAVY,_,GOLD_B,_,GOLD_B,_,_,NAVY,OUT,_],
  [_,OUT,NAVY,NAVY,NAVY,NAVY,NAVY,NAVY,NAVY,NAVY,OUT,_],
  [_,OUT,NAVY,GOLD_P,NAVY,GOLD_P,NAVY,GOLD_P,NAVY,NAVY,OUT,_],
  [_,OUT,NAVY,GOLD_P,GOLD_P,GOLD_P,GOLD_P,GOLD_P,NAVY,NAVY,OUT,_],
  [_,OUT,NAVY,GOLD_P,NAVY,NAVY,NAVY,GOLD_P,NAVY,NAVY,OUT,_],
  [_,OUT,NAVY,NAVY,NAVY,NAVY,NAVY,NAVY,NAVY,NAVY,OUT,_],
  [_,OUT,OUT,OUT,OUT,OUT,OUT,OUT,OUT,OUT,OUT,_],
  [_,_,_,_,_,_,_,_,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_],
];

const GRID_BY_KEY = {
  crown: CROWN_GRID,
  trophy: TROPHY_GRID,
  coffee: COFFEE_GRID,
  pullRequest: PULL_REQUEST_GRID,
  questionMark: QUESTION_MARK_GRID,
  continue: CONTINUE_GRID,
  pizza: PIZZA_GRID,
  wizardHat: WIZARD_HAT_GRID,
  notFound: NOT_FOUND_GRID,
};

const SPRITE_W = COLS * PX;
const SPRITE_H = ROWS * PX;

export default function SlotFiller({ typeKey }) {
  const grid = GRID_BY_KEY[typeKey];
  const shadow = useMemo(() => (grid ? spriteToBoxShadow(grid, PX) : ''), [grid]);
  if (!grid) return null;
  return (
    <div style={{ width: SPRITE_W, height: SPRITE_H, position: 'relative' }} data-cm-filler={typeKey}>
      <div style={{ ...SPRITE_PIXEL_STYLE, boxShadow: shadow }} />
    </div>
  );
}

export { SPRITE_W as FILLER_W, SPRITE_H as FILLER_H };
