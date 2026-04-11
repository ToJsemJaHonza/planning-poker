import { useState, useEffect, useMemo, useRef, useLayoutEffect } from 'react';
import PlayerFigure from './PlayerFigure';
import { useCinematicHandoff } from '../events/useCinematicHandoff';

/**
 * GH issue #2 — Tomáš DBB entrance (pixel-art L-pipe rewrite).
 *
 * The pipe is a segmented L-shape: one end is flush with a screen edge, it
 * bends twice, and its mouth opens inside the viewport. Tomáš EMERGES from
 * the mouth (he is invisible until then) and walks to his grid slot while
 * the pipe retracts back toward the anchor edge.
 *
 * All timers use the refs-in-effect-with-[] pattern — parent re-renders
 * MUST NOT restart the animation.
 */

// ---------------------------------------------------------------------------
// Palette — pure greyscale (UI Designer spec, matches reference pipe art)
// ---------------------------------------------------------------------------
const DBB = {
  outline:    '#0a0b11',    // hard black stepped silhouette
  fillDark:   '#3a3f47',    // bottom shadow band
  fillMid:    '#5a6069',    // main body (majority)
  fillLight:  '#7c838d',    // upper highlight band
  specular:   '#d8dbe0',    // 5-px specular ridge
  recessDark: '#1a1d23',    // mouth interior
  labelBg:    '#e8eaed',    // off-white plate for DBB tag
};

const THICKNESS = 50;

// ---------------------------------------------------------------------------
// Cylindrical shading helpers (multi-tone box-shadow insets)
// ---------------------------------------------------------------------------
function horizontalSegmentStyle() {
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

function verticalSegmentStyle() {
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
function CollarH({ position }) {
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

function CollarV({ position }) {
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
function renderMouthRecess(mouthDir) {
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
const PIPE_PATHS = {
  left:   [{ dir: 'right', len: 110 }, { dir: 'down',  len: 60 }, { dir: 'right', len: 90 }],
  right:  [{ dir: 'left',  len: 110 }, { dir: 'up',    len: 60 }, { dir: 'left',  len: 90 }],
  top:    [{ dir: 'down',  len: 100 }, { dir: 'right', len: 80 }, { dir: 'down',  len: 80 }],
  bottom: [{ dir: 'up',    len: 100 }, { dir: 'left',  len: 80 }, { dir: 'up',    len: 80 }],
};

/**
 * buildPipePath(fromSide, viewport) → { segments, mouth, anchorEdge,
 *                                       middleSegment, orientation }
 */
export function buildPipePath(fromSide, viewport) {
  const path = PIPE_PATHS[fromSide] || PIPE_PATHS.top;
  const vw = Math.max(320, viewport.w || 1024);
  const vh = Math.max(320, viewport.h || 768);

  let cx, cy;
  if (fromSide === 'left')   { cx = 0;      cy = Math.round(vh * 0.55); }
  if (fromSide === 'right')  { cx = vw;     cy = Math.round(vh * 0.55); }
  if (fromSide === 'top')    { cx = Math.round(vw * 0.35); cy = 0;  }
  if (fromSide === 'bottom') { cx = Math.round(vw * 0.35); cy = vh; }

  const segments = [];
  for (const step of path) {
    const { dir, len } = step;
    const extendedLen = len + THICKNESS;

    let x, y, w, h, nextCx, nextCy;
    if (dir === 'right') {
      x = cx - THICKNESS / 2;
      y = cy - THICKNESS / 2;
      w = extendedLen;
      h = THICKNESS;
      nextCx = cx + len;
      nextCy = cy;
    } else if (dir === 'left') {
      x = cx - (extendedLen - THICKNESS / 2);
      y = cy - THICKNESS / 2;
      w = extendedLen;
      h = THICKNESS;
      nextCx = cx - len;
      nextCy = cy;
    } else if (dir === 'down') {
      x = cx - THICKNESS / 2;
      y = cy - THICKNESS / 2;
      w = THICKNESS;
      h = extendedLen;
      nextCx = cx;
      nextCy = cy + len;
    } else { // 'up'
      x = cx - THICKNESS / 2;
      y = cy - (extendedLen - THICKNESS / 2);
      w = THICKNESS;
      h = extendedLen;
      nextCx = cx;
      nextCy = cy - len;
    }
    segments.push({ x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h), dir });
    cx = nextCx;
    cy = nextCy;
  }

  const EXTEND = THICKNESS / 2; // 25 — push mouth from path-end center to outer face
  const lastDir = path[path.length - 1].dir;
  let mouthX = cx;
  let mouthY = cy;
  if (lastDir === 'right')      mouthX += EXTEND;
  else if (lastDir === 'left')  mouthX -= EXTEND;
  else if (lastDir === 'down')  mouthY += EXTEND;
  else if (lastDir === 'up')    mouthY -= EXTEND;
  const mouth = { x: mouthX, y: mouthY, dir: lastDir };
  const mouthOrientation = (lastDir === 'right' || lastDir === 'left') ? 'horizontal' : 'vertical';

  return {
    segments,
    mouth,
    anchorEdge: fromSide,
    middleSegment: 1,
    orientation: mouthOrientation,
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function DbbPipeline({ fromSide = 'top', playerId, playerName, onPlayerExit, onDone }) {
  const [phase, setPhase] = useState('hidden');
  const [showTomas, setShowTomas] = useState(false);
  const [showArrivalBubble, setShowArrivalBubble] = useState(false);
  const tomasRef = useRef(null);
  const pipeGroupRef = useRef(null);

  const onPlayerExitRef = useRef(onPlayerExit);
  const onDoneRef = useRef(onDone);
  useEffect(() => { onPlayerExitRef.current = onPlayerExit; }, [onPlayerExit]);
  useEffect(() => { onDoneRef.current = onDone; }, [onDone]);

  const [viewport, setViewport] = useState(() => ({
    w: typeof window !== 'undefined' ? window.innerWidth : 1024,
    h: typeof window !== 'undefined' ? window.innerHeight : 768,
  }));
  useLayoutEffect(() => {
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const pipePath = useMemo(() => buildPipePath(fromSide, viewport), [fromSide, viewport]);

  // Handoff hook targets the placeholder keyed by session ID.
  // When unit tests pass only `playerName`, fall back to that.
  const targetKey = playerId || playerName;
  const handoff = useCinematicHandoff(
    targetKey,
    tomasRef,
    () => onPlayerExitRef.current?.()
  );

  useEffect(() => {
    const timers = [];
    // t=200: pipe starts sliding in
    timers.push(setTimeout(() => setPhase('slideIn'), 200));
    // t=1800: pipe settled + 200ms rest, bubble appears (alone, no plate yet)
    timers.push(setTimeout(() => setPhase('bubble'), 1800));
    // t=3200: bubble starts fading out
    timers.push(setTimeout(() => setPhase('bubbleOut'), 3200));
    // t=3600: plate appears, emerge starts — pipe + plate + Tomáš from mouth
    timers.push(setTimeout(() => { setPhase('emerge'); setShowTomas(true); }, 3600));
    // t=4400: walk starts (after 600ms emerge + 200ms breath)
    timers.push(setTimeout(() => {
      setPhase('walk');
      requestAnimationFrame(() => handoff.startHandoff());
    }, 4400));
    // t=6700: pipe starts retracting (walk handoff well underway)
    timers.push(setTimeout(() => setPhase('slideOut'), 6700));
    // t=6900: finishHandoff → markArrived → arrival bubble
    timers.push(setTimeout(() => {
      handoff.finishHandoff().then(() => {
        setShowTomas(false);
        setShowArrivalBubble(true);
        setTimeout(() => setShowArrivalBubble(false), 1600);
      });
    }, 6900));
    // t=9500: done
    timers.push(setTimeout(() => { setPhase('done'); onDoneRef.current?.(); }, 9500));
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (phase === 'done') return null;

  const { segments, mouth, middleSegment } = pipePath;
  const lastIdx = segments.length - 1;

  const edgeOffscreen = {
    top:    'translate(0, -120vh)',
    bottom: 'translate(0,  120vh)',
    left:   'translate(-120vw, 0)',
    right:  'translate( 120vw, 0)',
  }[fromSide];

  const groupTransform = (phase === 'hidden' || phase === 'slideOut')
    ? edgeOffscreen
    : 'translate(0, 0)';

  const showBubble = phase === 'bubble' || phase === 'bubbleOut';
  const bubbleOpacity = phase === 'bubble' ? 1 : 0;
  const showEmergeFx = phase === 'emerge';

  // Label is a CHILD of a segment — always rendered as part of the pipe. We
  // pick segment 0 (the longest anchor-end segment, 100–110 px) as the most
  // readable location. Orientation is derived from that segment's own dims.
  const labelSegmentIndex = 0;

  const midSeg = segments[middleSegment];
  const bubblePos = (() => {
    const cx = midSeg.x + midSeg.w / 2;
    const cy = midSeg.y + midSeg.h / 2;
    if (fromSide === 'left')   return { left: midSeg.x + midSeg.w + 20, top: cy, anchor: 'left' };
    if (fromSide === 'right')  return { left: midSeg.x - 20,              top: cy, anchor: 'right' };
    if (fromSide === 'top')    return { left: cx, top: midSeg.y + midSeg.h + 20, anchor: 'top' };
    return { left: cx, top: midSeg.y - 20, anchor: 'bottom' };
  })();

  const bubbleTransform = {
    left:   'translate(0, -50%)',
    right:  'translate(-100%, -50%)',
    top:    'translate(-50%, 0)',
    bottom: 'translate(-50%, -100%)',
  }[bubblePos.anchor];

  // Tomáš margins: put sprite's leading edge flush with the mouth face so
  // the transform-origin emerge animation grows outward correctly.
  const tomasMargin = (() => {
    switch (mouth.dir) {
      case 'right': return { marginLeft: 0,   marginTop: -35 };
      case 'left':  return { marginLeft: -60, marginTop: -35 };
      case 'down':  return { marginLeft: -30, marginTop: 0   };
      case 'up':    return { marginLeft: -30, marginTop: -70 };
      default:      return { marginLeft: -30, marginTop: -35 };
    }
  })();
  const emergeClass = `dbb-tomas-emerge-${mouth.dir}`;

  // Collar placement:
  // First segment has a collar on its anchor-edge side.
  // Last segment has a collar on its mouth-end side.
  // For horizontal pipes: 'start' = left side, 'end' = right side.
  // For vertical pipes:   'start' = top side,  'end' = bottom side.
  function collarFor(seg, i) {
    const isFirst = i === 0;
    const isLast = i === lastIdx;
    if (!isFirst && !isLast) return null;

    const horizontal = seg.w > seg.h;
    const items = [];

    if (isFirst) {
      // Anchor-edge collar depends on fromSide
      if (fromSide === 'left') items.push(<CollarH key="f" position="start" />);
      else if (fromSide === 'right') items.push(<CollarH key="f" position="end" />);
      else if (fromSide === 'top') items.push(<CollarV key="f" position="start" />);
      else items.push(<CollarV key="f" position="end" />);
    }

    if (isLast) {
      // Mouth-end collar depends on mouth.dir
      if (mouth.dir === 'right') items.push(<CollarH key="l" position="end" />);
      else if (mouth.dir === 'left') items.push(<CollarH key="l" position="start" />);
      else if (mouth.dir === 'down') items.push(<CollarV key="l" position="end" />);
      else items.push(<CollarV key="l" position="start" />);
    }

    // Sanity-avoid unused var lint
    void horizontal;
    return items;
  }

  return (
    <div style={styles.container} data-testid="dbb-pipeline">
      {/* Pipe group — retracts via inline transform driven by phase. */}
      <div
        ref={pipeGroupRef}
        data-dbb-pipe-group
        style={{
          position: 'absolute',
          inset: 0,
          transform: groupTransform,
          transition: 'transform 1.4s cubic-bezier(.2, .8, .2, 1)',
          pointerEvents: 'none',
        }}
      >
        {segments.map((seg, i) => {
          const horizontal = seg.w > seg.h;
          const segStyle = horizontal ? horizontalSegmentStyle() : verticalSegmentStyle();
          const isLabelSegVertical = seg.h > seg.w;
          return (
            <div
              key={i}
              data-dbb-segment={i}
              style={{
                position: 'absolute',
                left: `${seg.x}px`,
                top: `${seg.y}px`,
                width: `${seg.w}px`,
                height: `${seg.h}px`,
                ...segStyle,
              }}
            >
              {collarFor(seg, i)}
              {i === lastIdx && renderMouthRecess(mouth.dir)}
              {i === labelSegmentIndex && (
                <div
                  className="dbb-label-on-pipe"
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: isLabelSegVertical
                      ? 'translate(-50%, -50%) rotate(-90deg)'
                      : 'translate(-50%, -50%)',
                    fontFamily: "'Press Start 2P', monospace",
                    fontSize: '0.55rem',
                    color: '#e8eaed',
                    background: '#1a1d23',
                    padding: '4px 6px 2px',
                    letterSpacing: '2px',
                    lineHeight: 1,
                    border: '2px solid #0a0b11',
                    boxShadow: '2px 2px 0 #0a0b11',
                    whiteSpace: 'nowrap',
                    pointerEvents: 'none',
                    zIndex: 3,
                  }}
                >
                  DBB
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Mouth flash + steam puff — only during emerge */}
      {showEmergeFx && (
        <>
          <div
            className="dbb-mouth-flash"
            style={{
              left: `${mouth.x - 25}px`,
              top: `${mouth.y - 25}px`,
              width: 50,
              height: 50,
            }}
          />
          <div
            className="dbb-steam-puff"
            style={{
              left: `${mouth.x}px`,
              top: `${mouth.y - 10}px`,
            }}
          />
        </>
      )}

      {/* Bubble — alone during bubble phase, fades out during bubbleOut */}
      {showBubble && (
        <div
          style={{
            ...styles.bubble,
            left: `${bubblePos.left}px`,
            top: `${bubblePos.top}px`,
            transform: bubbleTransform,
            opacity: bubbleOpacity,
            transition: 'opacity 300ms',
          }}
        >
          DBB message has arrived — {playerName}
        </div>
      )}

      {/* Tomáš — invisible until emerge. Directional emerge class grows the
          sprite outward from the mouth face thanks to transform-origin. */}
      {showTomas && (
        <div
          ref={tomasRef}
          data-testid="dbb-tomas"
          className={phase === 'emerge' ? emergeClass : ''}
          style={{
            position: 'absolute',
            left: `${mouth.x}px`,
            top: `${mouth.y}px`,
            ...tomasMargin,
            zIndex: 195,
            ...((phase === 'walk' || phase === 'slideOut') ? {
              transform: handoff.transform,
              transition: `transform ${handoff.duration}ms steps(${handoff.stepCount}, end)`,
            } : {}),
          }}
        >
          <PlayerFigure
            name={playerName}
            holdingCard={false}
            walkFrame={phase === 'walk' ? handoff.walkFrame : null}
          />
        </div>
      )}

      {showArrivalBubble && (
        <ArrivalBubble targetKey={targetKey} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ArrivalBubble (unchanged behavior — parks over the grid slot).
// `targetKey` is the player's stable session ID (the Firebase key), which
// is also what `data-entrance-target` is set to on the grid placeholder.
// ---------------------------------------------------------------------------
function ArrivalBubble({ targetKey }) {
  const ref = useRef(null);
  const [fading, setFading] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const selector = `[data-entrance-target="${typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(targetKey) : targetKey}"]`;
    requestAnimationFrame(() => {
      const target = document.querySelector(selector);
      if (!target) return;
      const r = target.getBoundingClientRect();
      node.style.left = `${r.left + r.width / 2}px`;
      node.style.top = `${r.top - 8}px`;
      node.style.opacity = '1';
    });
    const fadeTimer = setTimeout(() => setFading(true), 1600 - 250);
    return () => clearTimeout(fadeTimer);
  }, [targetKey]);
  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        transform: 'translate(-50%, -100%)',
        opacity: fading ? 0 : undefined,
        transition: 'opacity 250ms steps(4, end)',
        background: '#fff',
        border: '3px solid #0a0b11',
        padding: '6px 12px',
        fontFamily: "'Press Start 2P', monospace",
        fontSize: '0.55rem',
        color: '#0a0b11',
        boxShadow: '4px 4px 0 #0a0b11',
        zIndex: 210,
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      merged to main
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const pixel = "'Press Start 2P', monospace";
const styles = {
  container: {
    position: 'fixed',
    inset: 0,
    zIndex: 190,
    pointerEvents: 'none',
    overflow: 'visible',
  },
  bubble: {
    position: 'absolute',
    background: '#fff',
    border: `4px solid ${DBB.outline}`,
    padding: '10px 16px',
    fontSize: '0.65rem',
    fontFamily: pixel,
    color: DBB.outline,
    boxShadow: `5px 5px 0 ${DBB.outline}`,
    whiteSpace: 'nowrap',
    textAlign: 'center',
    zIndex: 200,
    pointerEvents: 'none',
  },
};
