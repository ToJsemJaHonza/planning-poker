import { useState, useEffect, useMemo, useRef, useLayoutEffect } from 'react';
import { pixel } from './room/styles';
import {
  DBB, THICKNESS,
  horizontalSegmentStyle, verticalSegmentStyle,
  CollarH, CollarV,
  renderMouthRecess,
  BoltBand, HazardStripe, Gauge, RustSpecks,
  PIPE_PATHS,
} from '../sprites/dbbSprites.jsx';

/**
 * Tomas DBB entrance (pixel-art L-pipe).
 *
 * The pipe is a segmented L-shape: one end is flush with a screen edge, it
 * bends twice, and its mouth opens inside the viewport. Tomáš EMERGES from
 * the mouth (he is invisible until then) and walks to his grid slot while
 * the pipe retracts back toward the anchor edge.
 *
 * All timers use the refs-in-effect-with-[] pattern — parent re-renders
 * MUST NOT restart the animation.
 */

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
export default function DbbPipeline({ fromSide = 'top', playerId, playerName, onPlayerExit, onDone, entranceDirector }) {
  const [phase, setPhase] = useState('hidden');
  const [showArrivalBubble, setShowArrivalBubble] = useState(false);
  const pipeGroupRef = useRef(null);

  const onPlayerExitRef = useRef(onPlayerExit);
  const onDoneRef = useRef(onDone);
  const directorRef = useRef(entranceDirector);
  useEffect(() => { onPlayerExitRef.current = onPlayerExit; }, [onPlayerExit]);
  useEffect(() => { onDoneRef.current = onDone; }, [onDone]);
  useEffect(() => { directorRef.current = entranceDirector; }, [entranceDirector]);

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
  // Store the live pipe path in a ref so the timer-driven effect (which
  // can't re-declare itself to the new mouth each resize) reads the
  // latest mouth coords when the walk handoff fires.
  const pipePathRef = useRef(pipePath);
  pipePathRef.current = pipePath;
  const targetKey = playerId || playerName;

  useEffect(() => {
    const timers = [];
    // t=200: pipe starts sliding in
    timers.push(setTimeout(() => setPhase('slideIn'), 200));
    // t=1600: bolt bands fade in (decorative; pipe now looks bolted-down)
    timers.push(setTimeout(() => setPhase('bolt'), 1600));
    // t=2200: bubble appears (alone, no plate yet)
    timers.push(setTimeout(() => setPhase('bubble'), 2200));
    // t=3600: bubble starts fading out
    timers.push(setTimeout(() => setPhase('bubbleOut'), 3600));
    // t=4000: pipe rumbles — screen-local shake on the pipe group before emerge
    timers.push(setTimeout(() => setPhase('rumble'), 4000));
    // t=4300: packets stream through the pipe (build-up to emerge)
    timers.push(setTimeout(() => setPhase('packetFlow'), 4300));
    // t=4800: plate appears, emerge visual plays (character handled below)
    timers.push(setTimeout(() => { setPhase('emerge'); }, 4800));
    // t=5600: Tomáš steps out of the pipe — director teleports the
    // persistent character to the pipe mouth and walks it to its grid slot.
    timers.push(setTimeout(() => {
      setPhase('walk');
      const mouth = pipePathRef.current?.mouth;
      if (mouth && directorRef.current) {
        directorRef.current.walkFromDoor({
          playerId: targetKey,
          door: { x: mouth.x, y: mouth.y },
        });
      }
    }, 5600));
    // t=7900: pipe starts retracting.
    timers.push(setTimeout(() => setPhase('slideOut'), 7900));
    // t=8100: arrival bubble + onPlayerExit fallback. In production the
    // director's walkTo onDone has already fired markArrived; the manual
    // call here is idempotent and keeps unit tests without a stage
    // working.
    timers.push(setTimeout(() => {
      setShowArrivalBubble(true);
      setTimeout(() => setShowArrivalBubble(false), 1600);
      onPlayerExitRef.current?.();
    }, 8100));
    // t=10700: done
    timers.push(setTimeout(() => { setPhase('done'); onDoneRef.current?.(); }, 10700));
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

  // Decorators become visible once the pipe has landed.
  const showDecorators = !['hidden', 'slideIn', 'slideOut'].includes(phase);
  // Bolt bands fade in from the `bolt` phase onward.
  const showBolts = showDecorators && !['bolt-waiting'].includes(phase)
    && ['bolt','bubble','bubbleOut','rumble','packetFlow','emerge','walk'].includes(phase);
  const showPackets = phase === 'packetFlow' || phase === 'emerge';
  const isRumbling = phase === 'rumble' || phase === 'packetFlow';

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

  // Collar placement:
  // First segment has a collar on its anchor-edge side.
  // Last segment has a collar on its mouth-end side.
  function collarFor(seg, i) {
    const isFirst = i === 0;
    const isLast = i === lastIdx;
    if (!isFirst && !isLast) return null;

    const items = [];

    if (isFirst) {
      if (fromSide === 'left') items.push(<CollarH key="f" position="start" />);
      else if (fromSide === 'right') items.push(<CollarH key="f" position="end" />);
      else if (fromSide === 'top') items.push(<CollarV key="f" position="start" />);
      else items.push(<CollarV key="f" position="end" />);
    }

    if (isLast) {
      if (mouth.dir === 'right') items.push(<CollarH key="l" position="end" />);
      else if (mouth.dir === 'left') items.push(<CollarH key="l" position="start" />);
      else if (mouth.dir === 'down') items.push(<CollarV key="l" position="end" />);
      else items.push(<CollarV key="l" position="start" />);
    }

    return items;
  }

  // Packet particles — stream along the segments during `packetFlow`/`emerge`.
  // 4 packets staggered; each segment holds one row.
  const packets = showPackets ? segments.map((seg, i) => {
    const horizontal = seg.w > seg.h;
    const commonStyle = {
      position: 'absolute',
      width: 10,
      height: 6,
      background: '#fde047',
      boxShadow: `0 0 0 2px ${DBB.outline}`,
    };
    return (
      <div
        key={`packet-${i}`}
        className="dbb-packet"
        data-testid="dbb-packet"
        data-segment-idx={i}
        style={{
          ...commonStyle,
          ...(horizontal
            ? { top: '50%', left: 4, marginTop: -3, animationDelay: `${i * 80}ms` }
            : { left: '50%', top: 4, marginLeft: -5, animationDelay: `${i * 80}ms` }),
        }}
      />
    );
  }) : [];

  return (
    <div style={styles.container} data-testid="dbb-pipeline">
      {/* Pipe group — retracts via inline transform driven by phase. */}
      <div
        ref={pipeGroupRef}
        data-dbb-pipe-group
        className={isRumbling ? 'dbb-rumble' : undefined}
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
          const segOrient = horizontal ? 'horizontal' : 'vertical';
          const isLast = i === lastIdx;
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

              {/* Rust specks on every segment — purely decorative. */}
              {showDecorators && (
                <RustSpecks
                  seed={i + 1}
                  orientation={segOrient}
                  size={horizontal ? seg.w : seg.h}
                />
              )}

              {/* Bolt bands — first segment: near the anchor end.
                  Middle segment: around midpoint. Last segment: near mouth. */}
              {showBolts && (
                <BoltBand
                  orientation={segOrient}
                  offset={Math.round((horizontal ? seg.w : seg.h) * 0.28)}
                />
              )}

              {/* Hazard stripe + gauge on the mouth-end segment. */}
              {isLast && showDecorators && (
                <HazardStripe
                  orientation={segOrient}
                  length={Math.round((horizontal ? seg.w : seg.h) * 0.3)}
                  offset={Math.round((horizontal ? seg.w : seg.h) * 0.5)}
                />
              )}
              {isLast && showDecorators && (
                <Gauge style={horizontal
                  ? { top: -18, left: Math.round(seg.w * 0.35) }
                  : { left: -22, top: Math.round(seg.h * 0.35) }
                } />
              )}

              {/* Packets inside a segment during packetFlow. */}
              {showPackets && packets[i]}

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

      {/* Tomáš's figure is drawn by the shared CharacterStage — the
          director teleports the character to the pipe mouth when the
          emerge phase begins and walks it to the grid slot. Nothing to
          render here locally. */}

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
