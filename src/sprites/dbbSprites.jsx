/**
 * Pixel-art sprite data and styling for the DBB pipeline entrance animation.
 *
 * Extracted from DbbPipeline.jsx to keep the component focused on logic/rendering.
 */

import React from 'react';

// ---------------------------------------------------------------------------
// Palette — pure greyscale (UI Designer spec, matches reference pipe art)
// ---------------------------------------------------------------------------
export const DBB = {
  outline:    '#0a0b11',    // hard black stepped silhouette
  fillDark:   '#3a3f47',    // bottom shadow band
  fillMid:    '#5a6069',    // main body (majority)
  fillLight:  '#7c838d',    // upper highlight band
  specular:   '#d8dbe0',    // 5-px specular ridge
  recessDark: '#1a1d23',    // mouth interior
  labelBg:    '#e8eaed',    // off-white plate for DBB tag
};

export const THICKNESS = 50;

// ---------------------------------------------------------------------------
// Cylindrical shading helpers (multi-tone box-shadow insets)
// ---------------------------------------------------------------------------
export function horizontalSegmentStyle() {
  return {
    background: DBB.fillMid,
    boxShadow: [
      `inset 0 5px 0 0 ${DBB.outline}`,
      `inset 0 10px 0 0 ${DBB.specular}`,
      `inset 0 20px 0 0 ${DBB.fillLight}`,
      `inset 0 -5px 0 0 ${DBB.outline}`,
      `inset 0 -15px 0 0 ${DBB.fillDark}`,
      `0 0 0 5px ${DBB.outline}`,
    ].join(','),
    imageRendering: 'pixelated',
  };
}

export function verticalSegmentStyle() {
  return {
    background: DBB.fillMid,
    boxShadow: [
      `inset  5px 0 0 0 ${DBB.outline}`,
      `inset 10px 0 0 0 ${DBB.specular}`,
      `inset 20px 0 0 0 ${DBB.fillLight}`,
      `inset -5px 0 0 0 ${DBB.outline}`,
      `inset -15px 0 0 0 ${DBB.fillDark}`,
      `0 0 0 5px ${DBB.outline}`,
    ].join(','),
    imageRendering: 'pixelated',
  };
}

// ---------------------------------------------------------------------------
// Collar (flange) sub-components
// ---------------------------------------------------------------------------
export function CollarH({ position }) {
  const base = {
    position: 'absolute',
    width: 15,
    height: THICKNESS + 16,
    top: -8,
    background: DBB.fillDark,
    boxShadow: [
      `inset 0 5px 0 0 ${DBB.outline}`,
      `inset 0 10px 0 0 ${DBB.specular}`,
      `inset 0 -5px 0 0 ${DBB.outline}`,
      `0 0 0 5px ${DBB.outline}`,
    ].join(','),
    zIndex: 1,
  };
  return position === 'end'
    ? <div style={{ ...base, right: -5 }} />
    : <div style={{ ...base, left: -5 }} />;
}

export function CollarV({ position }) {
  const base = {
    position: 'absolute',
    height: 15,
    width: THICKNESS + 16,
    left: -8,
    background: DBB.fillDark,
    boxShadow: [
      `inset 5px 0 0 0 ${DBB.outline}`,
      `inset 10px 0 0 0 ${DBB.specular}`,
      `inset -5px 0 0 0 ${DBB.outline}`,
      `0 0 0 5px ${DBB.outline}`,
    ].join(','),
    zIndex: 1,
  };
  return position === 'end'
    ? <div style={{ ...base, bottom: -5 }} />
    : <div style={{ ...base, top: -5 }} />;
}

// ---------------------------------------------------------------------------
// Mouth recess overlay — dark interior + specular lip
// ---------------------------------------------------------------------------
export function renderMouthRecess(mouthDir) {
  const common = {
    position: 'absolute',
    width: 30,
    height: 30,
    background: DBB.recessDark,
    boxShadow: `inset 0 0 0 5px ${DBB.outline}, inset 0 5px 0 5px ${DBB.fillDark}`,
    zIndex: 2,
  };
  if (mouthDir === 'right') {
    return <>
      <div style={{ ...common, right: 8, top: 10 }} />
      <div style={{ position: 'absolute', right: 8, top: 10, width: 30, height: 5, background: DBB.specular, zIndex: 3 }} />
    </>;
  }
  if (mouthDir === 'left') {
    return <>
      <div style={{ ...common, left: 8, top: 10 }} />
      <div style={{ position: 'absolute', left: 8, top: 10, width: 30, height: 5, background: DBB.specular, zIndex: 3 }} />
    </>;
  }
  if (mouthDir === 'down') {
    return <>
      <div style={{ ...common, bottom: 8, left: 10 }} />
      <div style={{ position: 'absolute', bottom: 8, left: 10, width: 5, height: 30, background: DBB.specular, zIndex: 3 }} />
    </>;
  }
  // up
  return <>
    <div style={{ ...common, top: 8, left: 10 }} />
    <div style={{ position: 'absolute', top: 8, left: 10, width: 5, height: 30, background: DBB.specular, zIndex: 3 }} />
  </>;
}

// ---------------------------------------------------------------------------
// Pipe path tables (stored as CSS px)
// ---------------------------------------------------------------------------
export const PIPE_PATHS = {
  left:   [{ dir: 'right', len: 110 }, { dir: 'down',  len: 60 }, { dir: 'right', len: 90 }],
  right:  [{ dir: 'left',  len: 110 }, { dir: 'up',    len: 60 }, { dir: 'left',  len: 90 }],
  top:    [{ dir: 'down',  len: 100 }, { dir: 'right', len: 80 }, { dir: 'down',  len: 80 }],
  bottom: [{ dir: 'up',    len: 100 }, { dir: 'left',  len: 80 }, { dir: 'up',    len: 80 }],
};
