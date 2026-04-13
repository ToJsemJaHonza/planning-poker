import { useState, useEffect, useMemo, useRef } from 'react';
import Crown from './Crown';
import { spriteToBoxShadow, PX, SPRITE_PIXEL_STYLE } from '../engine/sprite';
import { WALK_FRAME_MS } from '../engine/animation';

const _ = null;
const O = '#222';     // outline
const S = '#f0c8a0'; // skin
const P = '#d09868'; // skin shadow
const H = '#4a3020'; // hair dark brown
const W = '#fff';     // white (shirt)
const B = '#2c3e50'; // blazer/suit dark
const T = '#34495e'; // blazer lighter
const R = '#c0392b'; // tie red
const G = '#3498db'; // glasses blue
const K = '#1a1a2e'; // shoes
const L = '#2980b9'; // laptop/pointer
const Y = '#f5c542'; // gold accent
const N = '#95a5a6'; // laptop gray
const Q = '#ecf0f1'; // shirt lighter

// 10w × 14h — Project Manager: neat hair, glasses, blazer, red tie, pointer
const WALK_1 = [
  [_,_,_,H,H,H,H,_,_,_],  // hair top
  [_,_,H,H,H,H,H,H,_,_],  // hair full
  [_,_,H,S,S,S,S,H,_,_],  // forehead
  [_,_,S,G,S,S,G,S,_,_],  // eyes + glasses
  [_,_,S,S,S,P,S,S,_,_],  // nose
  [_,_,_,S,S,S,S,_,_,_],  // chin
  [_,_,B,W,R,R,W,B,_,_],  // collar + tie
  [_,B,B,W,R,R,W,B,B,_],  // upper body
  [_,B,S,B,W,W,B,S,B,_],  // arms + shirt
  [_,_,B,B,R,R,B,B,_,_],  // belt area
  [_,_,B,B,B,B,B,B,_,_],  // pants
  [_,_,_,B,B,B,B,_,_,_],  // pants lower
  [_,_,_,K,_,_,K,_,_,_],  // legs
  [_,_,K,K,_,_,K,K,_,_],  // shoes frame 1
];

const WALK_2 = [
  ...WALK_1.slice(0, 12),
  [_,_,_,K,_,_,K,_,_,_],  // legs
  [_,_,_,K,K,K,K,_,_,_],  // shoes together
];

// "Reveal" pose — holding pointer up, confident stance
const CAST = [
  [_,_,_,H,H,H,H,_,_,_],
  [_,_,H,H,H,H,H,H,_,_],
  [_,_,H,S,S,S,S,H,_,_],
  [_,_,S,Y,S,S,Y,S,_,_],  // glasses glint gold
  [_,_,S,S,S,P,S,S,_,_],
  [_,_,_,S,S,S,S,_,_,_],
  [_,_,B,W,R,R,W,B,L,_],  // pointer raised
  [_,B,B,W,R,R,W,B,L,_],  // pointer
  [_,B,_,B,W,W,B,S,L,_],  // arm up with pointer
  [_,_,B,B,R,R,B,B,Y,_],  // pointer tip gold
  [_,_,B,B,B,B,B,B,_,_],
  [_,_,_,B,B,B,B,_,_,_],
  [_,_,_,K,_,_,K,_,_,_],
  [_,_,K,K,_,_,K,K,_,_],
];

// Thinking — hand on chin, looking up
const THINK = [
  [_,_,_,H,H,H,H,_,_,_],
  [_,_,H,H,H,H,H,H,_,_],
  [_,_,H,S,S,S,S,H,_,_],
  [_,_,S,G,_,_,G,S,_,_],  // eyes looking up
  [_,_,S,S,S,P,S,S,_,_],
  [_,_,_,S,S,S,S,S,_,_],  // hand on chin
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

const QUOTES = [
  // Michael Scott classics
  "That's what she said",
  "I'm not superstitious... just a little stitious",
  "Would I rather be feared or loved? Both. I want people to be afraid of how much they love me",
  "I am Beyoncé, always",
  "Sometimes I'll start a sentence and I don't even know where it's going",
  "I'm an early bird and a night owl. So I'm wise and have worms",
  "You miss 100% of the shots you don't take",
  "I knew exactly what to do. But in a much more real sense, I had no idea what to do",
  "I am running away from my responsibilities. And it feels good",
  "I'm not a hero. I'm a dynamic manager",
  "It's a beautiful day to estimate tickets",
  "Why are you the way that you are?",
  "I declare bankruptcy!",
  "That is a $200 plasma screen TV that you just killed!",
  // PM classics
  "Let's circle back on this",
  "Can we align on this?",
  "Let's put a pin in it",
  "Per my last email...",
  "Quick sync anyone?",
  "Let's take this offline",
  "Think outside the box!",
  "Low-hanging fruit!",
  "Let's double-click on that",
  "Who owns this?",
  "It's on the roadmap",
  "Ballpark estimate?",
  "Let's timebox this",
  "We need more synergy",
  "Is this scalable?",
  "What's the bandwidth?",
  "Let's leverage this",
  "Action items, people!",
  "We need to pivot",
  "Moving the needle here",
  "Let's boil the ocean",
  "This is a paradigm shift",
  "Can we get a RACI on this?",
  "Let's parking lot that",
];

export default function Wizard({
  isCasting,
  onCastComplete,
  onQuote,
  externalQuote,
  // Two modes: 'idle' (JS-driven walk) and 'ceremony' (parent-driven position).
  mode = 'idle',
  crowningPose = null,
  crowningBubble = '',
  crownState = null,
  crownGlowing = false,
  ceremonyFacing = null,
  // JS-driven position from useWizardPosition hook (idle mode).
  // When mode='idle', parent passes { x, y, facingLeft }.
  position = null,
  facingLeft = false,
}) {
  const [walkFrame, setWalkFrame] = useState(0);
  const [showSparkles, setShowSparkles] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [quote, setQuote] = useState('');
  const walkRef = useRef(null);
  const castRef = useRef(null);
  const thinkRef = useRef(null);

  // For non-leader: show externalQuote as thinking pose
  const showExtQuote = !onQuote && !!externalQuote;

  useEffect(() => {
    // Ceremony mode uses its own pose driven by parent — no idle loop.
    if (mode !== 'idle') {
      clearInterval(walkRef.current);
      clearTimeout(thinkRef.current);
      setIsThinking(false);
      return;
    }
    if (isCasting) {
      clearInterval(walkRef.current);
      clearTimeout(thinkRef.current);
      setIsThinking(false);
      return;
    }
    walkRef.current = setInterval(() => setWalkFrame(f => f ^ 1), WALK_FRAME_MS);

    // Only leader runs the thinking/quote loop
    if (!onQuote) return () => clearInterval(walkRef.current);

    const loop = () => {
      thinkRef.current = setTimeout(() => {
        if (!isCasting) {
          if (Math.random() < 0.2) {
            const q = QUOTES[Math.floor(Math.random() * QUOTES.length)];
            setQuote(q);
            onQuote?.(q);
          } else {
            setQuote('');
            onQuote?.('');
          }
          setIsThinking(true);
          setTimeout(() => {
            setIsThinking(false);
            onQuote?.('');
            loop();
          }, 2500 + Math.random() * 1500);
        }
      }, 5000 + Math.random() * 8000);
    };
    loop();
    return () => { clearInterval(walkRef.current); clearTimeout(thinkRef.current); };
  }, [isCasting, mode]);

  useEffect(() => {
    if (!isCasting) return;
    setShowSparkles(true);
    castRef.current = setTimeout(() => { setShowSparkles(false); onCastComplete?.(); }, 1400);
    return () => clearTimeout(castRef.current);
  }, [isCasting, onCastComplete]);

  const sw1 = useMemo(() => spriteToBoxShadow(WALK_1, PX), []);
  const sw2 = useMemo(() => spriteToBoxShadow(WALK_2, PX), []);
  const sc = useMemo(() => spriteToBoxShadow(CAST, PX), []);
  const st = useMemo(() => spriteToBoxShadow(THINK, PX), []);

  // Non-leader: pause when externalQuote is showing
  const effectiveThinking = onQuote ? isThinking : showExtQuote;
  const effectiveQuote = onQuote ? quote : (externalQuote || '');

  // Select sprite shadow. Ceremony mode drives pose via `crowningPose`;
  // idle mode uses the existing logic unchanged.
  let shadow;
  if (mode === 'ceremony') {
    if (crowningPose === 'cast') shadow = sc;
    else shadow = walkFrame ? sw2 : sw1;
  } else {
    shadow = isCasting ? sc : effectiveThinking ? st : walkFrame ? sw2 : sw1;
  }

  // --- CEREMONY MODE (iter 4): position driven by parent, vertical movement ---
  if (mode === 'ceremony') {
    const facingLeft = ceremonyFacing === 'left';
    const crownPinned = crownState?.mode === 'settled';
    return (
      <div
        style={{
          position: 'relative',
          width: SPRITE_W,
          height: SPRITE_H,
          pointerEvents: 'none',
          imageRendering: 'pixelated',
          transform: facingLeft ? 'scaleX(-1)' : 'scaleX(1)',
        }}
        data-cm-wizard-ceremony
      >
        <div style={{ position: 'absolute', inset: 0 }}>
          <div style={{ ...SPRITE_PIXEL_STYLE, boxShadow: shadow }} />
        </div>
        {crowningBubble && (
          <div style={{
            ...styles.crowningBubble,
            // Counteract parent scaleX flip so text reads normally
            transform: `translateX(-50%) ${facingLeft ? 'scaleX(-1)' : 'scaleX(1)'}`,
          }}>{crowningBubble}</div>
        )}
        {crownState && !crownPinned && (
          <Crown
            glowing={crownGlowing}
            style={{
              left: 8 * PX,
              top: 4 * PX,
              transform: crownState.mode === 'arcing'
                ? `translate(0px, ${crownState.progress * 45}px)`
                : crownState.mode === 'lifting'
                  ? `translate(0px, ${crownState.progress * -50}px)`
                  : 'none',
              transition: (crownState.mode === 'arcing' || crownState.mode === 'lifting')
                ? 'transform 300ms steps(12, end)' : 'none',
            }}
          />
        )}
      </div>
    );
  }

  // --- IDLE MODE (default): JS-driven walk via useWizardPosition ----------
  // Position is controlled by the parent via the `position` and `facingLeft`
  // props from the useWizardPosition hook. No CSS keyframes involved.
  // The wizard is positioned with `position: fixed` and `transform: translate`
  // for GPU-composited movement.
  const idleFacingLeft = facingLeft;
  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        transform: `translate(${position?.x ?? 10}px, ${position?.y ?? 0}px)`,
        zIndex: 50,
        pointerEvents: 'none',
        imageRendering: 'pixelated',
        willChange: 'transform',
      }}
      data-wizard-idle
    >
      <div style={{
        ...styles.idleInner,
        transform: idleFacingLeft ? 'scaleX(-1)' : 'scaleX(1)',
      }}>
        <div style={{ ...SPRITE_PIXEL_STYLE, boxShadow: shadow }} />
        {showSparkles && SPARKLE_DIRS.map((d, i) => (
          <span key={i} style={{
            ...styles.sparkle,
            '--dx': `${d.dx}px`, '--dy': `${d.dy}px`,
            left: `${8 * PX}px`, top: `${5 * PX}px`,
            animationDelay: `${i * 0.05}s`,
          }}>✦</span>
        ))}
      </div>
      {effectiveThinking && effectiveQuote && (
        <div style={styles.idleBubble}>
          <span style={idleFacingLeft ? { display: 'inline-block', transform: 'scaleX(-1)' } : undefined}>
            {effectiveQuote}
          </span>
        </div>
      )}
    </div>
  );
}

const styles = {
  // Idle mode: the sprite lives inside a JS-positioned fixed container.
  // Position is relative within that container.
  idleInner: { position: 'relative', width: SPRITE_W, height: SPRITE_H, imageRendering: 'pixelated' },
  sparkle: {
    position: 'absolute', fontSize: 18, color: '#f5c542', pointerEvents: 'none',
    animation: 'sparkle-burst 1.2s ease-out forwards',
    textShadow: '0 0 8px #f5c542, 0 0 16px #d4a853',
  },
  // Idle bubble: positioned above the sprite. The parent container uses
  // JS-driven positioning (not CSS keyframes), so the bubble flipping is
  // handled inline via the `facingLeft` prop instead of the old
  // wizard-bubble-unflip CSS animation.
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
    // nowrap prevents the vertical-text bug: the bubble is positioned inside
    // a 50px-wide wizard sprite container, and break-word + normal white-space
    // caused the browser to wrap after every character. Ceremony phrases are
    // short (<30 chars) and never need wrapping.
    whiteSpace: 'nowrap',
    marginBottom: 4,
    zIndex: 212,
  },
};
