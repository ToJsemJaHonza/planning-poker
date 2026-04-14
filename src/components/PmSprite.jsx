import { useMemo } from 'react';
import Crown from './Crown';
import { spriteToBoxShadow, PX, SPRITE_PIXEL_STYLE } from '../engine/sprite';
import { usePmModel } from '../hooks/usePmModel';

const _ = null;
const O = '#222';     // outline (kept for sprite-edit symmetry)
const S = '#f0c8a0'; // skin
const P = '#d09868'; // skin shadow
const H = '#4a3020'; // hair dark brown
const W = '#fff';     // white (shirt)
const B = '#2c3e50'; // blazer/suit dark
const T = '#34495e'; // blazer lighter (sprite-edit reserve)
const R = '#c0392b'; // tie red
const G = '#3498db'; // glasses blue
const K = '#1a1a2e'; // shoes
const L = '#2980b9'; // laptop/pointer
const Y = '#f5c542'; // gold accent
const N = '#95a5a6'; // laptop gray (sprite-edit reserve)
const Q = '#ecf0f1'; // shirt lighter (sprite-edit reserve)

// 10w × 14h — Project Manager: neat hair, glasses, blazer, red tie, pointer
const WALK_1 = [
  [_,_,_,H,H,H,H,_,_,_],
  [_,_,H,H,H,H,H,H,_,_],
  [_,_,H,S,S,S,S,H,_,_],
  [_,_,S,G,S,S,G,S,_,_],
  [_,_,S,S,S,P,S,S,_,_],
  [_,_,_,S,S,S,S,_,_,_],
  [_,_,B,W,R,R,W,B,_,_],
  [_,B,B,W,R,R,W,B,B,_],
  [_,B,S,B,W,W,B,S,B,_],
  [_,_,B,B,R,R,B,B,_,_],
  [_,_,B,B,B,B,B,B,_,_],
  [_,_,_,B,B,B,B,_,_,_],
  [_,_,_,K,_,_,K,_,_,_],
  [_,_,K,K,_,_,K,K,_,_],
];

const WALK_2 = [
  ...WALK_1.slice(0, 12),
  [_,_,_,K,_,_,K,_,_,_],
  [_,_,_,K,K,K,K,_,_,_],
];

const CAST = [
  [_,_,_,H,H,H,H,_,_,_],
  [_,_,H,H,H,H,H,H,_,_],
  [_,_,H,S,S,S,S,H,_,_],
  [_,_,S,Y,S,S,Y,S,_,_],
  [_,_,S,S,S,P,S,S,_,_],
  [_,_,_,S,S,S,S,_,_,_],
  [_,_,B,W,R,R,W,B,L,_],
  [_,B,B,W,R,R,W,B,L,_],
  [_,B,_,B,W,W,B,S,L,_],
  [_,_,B,B,R,R,B,B,Y,_],
  [_,_,B,B,B,B,B,B,_,_],
  [_,_,_,B,B,B,B,_,_,_],
  [_,_,_,K,_,_,K,_,_,_],
  [_,_,K,K,_,_,K,K,_,_],
];

const THINK = [
  [_,_,_,H,H,H,H,_,_,_],
  [_,_,H,H,H,H,H,H,_,_],
  [_,_,H,S,S,S,S,H,_,_],
  [_,_,S,G,_,_,G,S,_,_],
  [_,_,S,S,S,P,S,S,_,_],
  [_,_,_,S,S,S,S,S,_,_],
  [_,_,B,W,R,R,W,B,_,_],
  [_,B,B,W,R,R,W,B,B,_],
  [_,B,_,B,W,W,B,_,B,_],
  [_,_,B,B,R,R,B,B,_,_],
  [_,_,B,B,B,B,B,B,_,_],
  [_,_,_,B,B,B,B,_,_,_],
  [_,_,_,K,_,_,K,_,_,_],
  [_,_,K,K,_,_,K,K,_,_],
];

const COLS = 10;
const ROWS = 14;
const SPRITE_W = COLS * PX;
const SPRITE_H = ROWS * PX;

const SPARKLE_DIRS = [
  { dx: -18, dy: -25 }, { dx: 8, dy: -30 }, { dx: 25, dy: -15 },
  { dx: 28, dy: 5 }, { dx: -10, dy: -35 }, { dx: 20, dy: -28 },
  { dx: -22, dy: -10 }, { dx: 12, dy: -38 },
];

/**
 * PmSprite — pure renderer.
 *
 * All timing, pose decisions, quote management, and sparkle scheduling
 * live in usePmModel. PmSprite reads the model and paints; it does not
 * own any state, intervals, or timeouts.
 *
 * The component still accepts the legacy prop surface (isCasting,
 * onQuote, externalQuote, etc.) so callers don't have to know about the
 * model — it instantiates one internally per mount. If a future caller
 * wants to share a single model across mounts (e.g. to coordinate the
 * idle and ceremony PMs), it can pass `model` directly and the internal
 * `usePmModel` call will be skipped via the prop precedence below.
 */
export default function PmSprite({
  isCasting = false,
  onCastComplete,
  onQuote,
  externalQuote,
  mode = 'idle',
  pmPose = null,
  pmBubble = '',
  crownState = null,
  crownGlowing = false,
  ceremonyFacing = null,
  position = null,
  facingLeft = false,
  model: modelProp = null,
}) {
  const localModel = usePmModel({
    mode,
    isLeader: !!onQuote,
    isCasting,
    externalQuote: externalQuote || '',
    onQuote,
    onCastComplete,
    position,
    facingLeft,
    pmPose,
    pmBubble,
    ceremonyFacing,
    crownState,
    crownGlowing,
  });
  const model = modelProp ?? localModel;

  const sw1 = useMemo(() => spriteToBoxShadow(WALK_1, PX), []);
  const sw2 = useMemo(() => spriteToBoxShadow(WALK_2, PX), []);
  const sc = useMemo(() => spriteToBoxShadow(CAST, PX), []);
  const st = useMemo(() => spriteToBoxShadow(THINK, PX), []);

  let shadow;
  switch (model.pose) {
    case 'cast': shadow = sc; break;
    case 'think': shadow = st; break;
    default: shadow = model.walkFrame ? sw2 : sw1;
  }

  // --- CEREMONY MODE: position driven by parent ---
  if (model.mode === 'ceremony') {
    const crownPinned = model.crownState?.mode === 'settled';
    return (
      <div
        style={{
          position: 'relative',
          width: SPRITE_W,
          height: SPRITE_H,
          pointerEvents: 'none',
          imageRendering: 'pixelated',
          transform: model.facingLeft ? 'scaleX(-1)' : 'scaleX(1)',
        }}
        data-cm-pm-ceremony
      >
        <div style={{ position: 'absolute', inset: 0 }}>
          <div style={{ ...SPRITE_PIXEL_STYLE, boxShadow: shadow }} />
        </div>
        {model.showBubble && (
          <div style={{
            ...styles.crowningBubble,
            transform: `translateX(-50%) ${model.facingLeft ? 'scaleX(-1)' : 'scaleX(1)'}`,
          }}>{model.bubble}</div>
        )}
        {model.crownState && !crownPinned && (
          <Crown
            glowing={model.crownGlowing}
            style={{
              left: 8 * PX,
              top: 4 * PX,
              transform: model.crownState.mode === 'arcing'
                ? `translate(0px, ${model.crownState.progress * 45}px)`
                : model.crownState.mode === 'lifting'
                  ? `translate(0px, ${model.crownState.progress * -50}px)`
                  : 'none',
              transition: (model.crownState.mode === 'arcing' || model.crownState.mode === 'lifting')
                ? 'transform 300ms steps(12, end)' : 'none',
            }}
          />
        )}
      </div>
    );
  }

  // --- IDLE MODE ---
  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        transform: `translate(${model.position?.x ?? 10}px, ${model.position?.y ?? 0}px)`,
        zIndex: 50,
        pointerEvents: 'none',
        imageRendering: 'pixelated',
        willChange: 'transform',
      }}
      data-pm-idle
    >
      <div style={{
        ...styles.idleInner,
        transform: model.facingLeft ? 'scaleX(-1)' : 'scaleX(1)',
      }}>
        <div style={{ ...SPRITE_PIXEL_STYLE, boxShadow: shadow }} />
        {model.showSparkles && SPARKLE_DIRS.map((d, i) => (
          <span key={i} style={{
            ...styles.sparkle,
            '--dx': `${d.dx}px`, '--dy': `${d.dy}px`,
            left: `${8 * PX}px`, top: `${5 * PX}px`,
            animationDelay: `${i * 0.05}s`,
          }}>✦</span>
        ))}
      </div>
      {model.showBubble && (
        <div style={styles.idleBubble}>{model.bubble}</div>
      )}
    </div>
  );
}

const styles = {
  idleInner: { position: 'relative', width: SPRITE_W, height: SPRITE_H, imageRendering: 'pixelated' },
  sparkle: {
    position: 'absolute', fontSize: 18, color: '#f5c542', pointerEvents: 'none',
    animation: 'sparkle-burst 1.2s ease-out forwards',
    textShadow: '0 0 8px #f5c542, 0 0 16px #d4a853',
  },
  idleBubble: {
    position: 'absolute',
    bottom: SPRITE_H + 10,
    left: '50%',
    zIndex: 51,
    background: '#fff',
    border: '2px solid #d4a853',
    borderRadius: '6px',
    padding: '5px 10px',
    fontSize: '0.65rem',
    fontFamily: "'Press Start 2P', monospace",
    color: '#2a2a3a',
    whiteSpace: 'nowrap',
    lineHeight: '1.6',
    animation: 'float 1.5s ease-in-out infinite',
    boxShadow: '2px 2px 0 #b8922e',
    textAlign: 'center',
  },
  crowningBubble: {
    position: 'absolute',
    bottom: '100%',
    left: '50%',
    transform: 'translateX(-50%)',
    background: '#fff',
    border: '2px solid #d4a853',
    padding: '5px 10px',
    fontSize: '0.5rem',
    fontFamily: "'Press Start 2P', monospace",
    color: '#2a2a3a',
    boxShadow: '2px 2px 0 #b8922e',
    whiteSpace: 'nowrap',
    marginBottom: 4,
    zIndex: 212,
  },
};
