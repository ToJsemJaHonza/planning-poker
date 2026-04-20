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
// Industrial decorator components — bolt bands, hazard stripes, gauge, rust.
// Rendered as children of a pipe segment so they scale with the pipe.
// ---------------------------------------------------------------------------

/**
 * BoltBand — 4 bolt heads on a narrow perpendicular band. Orientation
 * 'horizontal' draws a vertical band across a horizontal segment; vice versa.
 */
export function BoltBand({ orientation = 'horizontal', offset = 30 }) {
  const isHorizontalSeg = orientation === 'horizontal';
  const bandStyle = isHorizontalSeg
    ? {
        position: 'absolute',
        top: -3,
        left: offset,
        width: 10,
        height: THICKNESS + 6,
        background: DBB.fillDark,
        boxShadow: `inset 0 0 0 2px ${DBB.outline}`,
        zIndex: 2,
      }
    : {
        position: 'absolute',
        left: -3,
        top: offset,
        height: 10,
        width: THICKNESS + 6,
        background: DBB.fillDark,
        boxShadow: `inset 0 0 0 2px ${DBB.outline}`,
        zIndex: 2,
      };
  const boltStyle = {
    position: 'absolute',
    width: 6,
    height: 6,
    background: DBB.specular,
    boxShadow: `inset 0 0 0 1px ${DBB.outline}, 0 0 0 1px ${DBB.outline}`,
    borderRadius: 1,
  };
  // 4 bolts spread across the band (positions along the long axis of the band)
  const positions = [0.15, 0.38, 0.62, 0.85];
  return (
    <div className="dbb-bolt-band" data-testid="dbb-bolt-band" style={bandStyle}>
      {positions.map((p, i) => {
        const coord = Math.round(p * (THICKNESS + 6) - 3);
        return (
          <div
            key={i}
            style={{
              ...boltStyle,
              ...(isHorizontalSeg ? { top: coord, left: 2 } : { left: coord, top: 2 }),
            }}
          />
        );
      })}
    </div>
  );
}

/**
 * HazardStripe — repeating diagonal yellow-black band on a pipe segment.
 */
export function HazardStripe({ orientation = 'horizontal', length = 40, offset = 10 }) {
  const isHorizontalSeg = orientation === 'horizontal';
  const common = {
    position: 'absolute',
    background: 'repeating-linear-gradient(45deg, #fde047 0 6px, #0a0b11 6px 12px)',
    boxShadow: `inset 0 0 0 2px ${DBB.outline}`,
    zIndex: 2,
  };
  const style = isHorizontalSeg
    ? { ...common, top: 4, left: offset, width: length, height: 8 }
    : { ...common, left: 4, top: offset, height: length, width: 8 };
  return <div className="dbb-hazard-stripe" data-testid="dbb-hazard-stripe" style={style} />;
}

/**
 * Gauge — 20×16 pressure dial with a sweeping needle. Positioned via `style`
 * overrides; the needle animates via the `dbb-gauge-needle` class.
 */
export function Gauge({ style: overrideStyle = {} }) {
  return (
    <div
      className="dbb-gauge"
      data-testid="dbb-gauge"
      style={{
        position: 'absolute',
        width: 20,
        height: 16,
        background: '#0a0b11',
        boxShadow: `inset 0 0 0 2px ${DBB.specular}`,
        zIndex: 3,
        ...overrideStyle,
      }}
    >
      {/* Dial face */}
      <div style={{
        position: 'absolute',
        inset: 2,
        background: DBB.labelBg,
        boxShadow: `inset 0 0 0 1px ${DBB.outline}`,
      }} />
      {/* Needle */}
      <div
        className="dbb-gauge-needle"
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: 7,
          height: 2,
          background: '#b91c1c',
          transformOrigin: '1px 1px',
          transform: 'rotate(-45deg)',
        }}
      />
    </div>
  );
}

/**
 * RustSpecks — 6 seeded, pseudo-random rust spots scattered over a segment.
 * Pure decoration; positions are fixed per `seed` so renders are stable.
 */
export function RustSpecks({ seed = 1, orientation = 'horizontal', size = 120 }) {
  // Deterministic pseudo-random — small LCG so positions are stable per seed.
  const rand = (i) => {
    const x = Math.sin((seed + i) * 9301) * 10000;
    return x - Math.floor(x);
  };
  const isHorizontalSeg = orientation === 'horizontal';
  const specks = [];
  for (let i = 0; i < 6; i++) {
    const along = Math.round(rand(i) * size);
    const across = Math.round(rand(i + 100) * (THICKNESS - 8)) + 4;
    specks.push({ along, across, w: 2 + Math.round(rand(i + 200) * 3) });
  }
  return (
    <div
      className="dbb-rust-specks"
      data-testid="dbb-rust-specks"
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2 }}
    >
      {specks.map((s, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            ...(isHorizontalSeg ? { left: s.along, top: s.across } : { top: s.along, left: s.across }),
            width: s.w,
            height: s.w,
            background: '#7f3f1a',
            boxShadow: `0 0 0 1px rgba(40, 18, 8, 0.55)`,
          }}
        />
      ))}
    </div>
  );
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
