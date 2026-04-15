import { useEffect, useRef, useState } from 'react';
import { useFrameToggle, useFrameTicker } from '../engine/useFrameTicker';
import { WALK_FRAME_MS } from '../engine/animation';

// Centralised PM quote pool. Lives here (not in PmSprite) so the model is
// the single owner of "what the PM is currently saying" — the renderer
// just consumes the string.
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

const SPARKLE_MS = 1400;
const QUOTE_CHANCE = 0.2;
const WAIT_MIN_MS = 5000;
const WAIT_RANDOM_MS = 8000;
const THINK_MIN_MS = 2500;
const THINK_RANDOM_MS = 1500;

function pickQuote() {
  return QUOTES[Math.floor(Math.random() * QUOTES.length)];
}

/**
 * usePmModel — single derived-state hook for the PM sprite.
 *
 * Replaces the per-instance state, setIntervals, and chained setTimeouts
 * that used to live inside PmSprite. After this hook runs, the PmSprite
 * component is a pure renderer: every prop it consumes is a deterministic
 * function of the model.
 *
 * Two modes:
 *   - 'idle'      : floating PM at bottom of screen, owns walk-frame +
 *                   thinking loop + cast sparkle effect.
 *   - 'ceremony'  : pose / position driven externally by ceremony hooks.
 *                   Hook still owns walk-frame so leg swap stays in sync
 *                   with idle PM and other walkers.
 *
 * @param {object} opts
 * @param {'idle'|'ceremony'} [opts.mode='idle']
 * @param {boolean} [opts.isLeader=false]   Drives whether we run the
 *   thinking-quote loop (only the leader publishes quotes to Firebase).
 * @param {boolean} [opts.isCasting=false]  When true: pose=cast, sparkles
 *   fire, walkFrame freezes, leader loop pauses.
 * @param {string} [opts.externalQuote='']  Quote pulled from Firebase for
 *   non-leader clients to render.
 * @param {((q: string) => void)|null} [opts.onQuote]   Leader-only
 *   callback to publish quote string to Firebase.
 * @param {(() => void)|null} [opts.onCastComplete]     Fires once after
 *   the sparkle window closes.
 * @param {{x:number,y:number}|null} [opts.position]    Idle position from
 *   usePmPosition.
 * @param {boolean} [opts.facingLeft=false]             Idle facing.
 * @param {'cast'|'walk'|null} [opts.pmPose=null]       Ceremony-driven pose.
 * @param {string} [opts.pmBubble='']                   Ceremony bubble text.
 * @param {'left'|'right'|null} [opts.ceremonyFacing]   Ceremony facing.
 * @param {object|null} [opts.crownState]               Crown phase from ceremony.
 * @param {boolean} [opts.crownGlowing=false]
 * @returns {{
 *   mode: 'idle'|'ceremony',
 *   walkFrame: 0|1,
 *   pose: 'walk'|'cast'|'think',
 *   showSparkles: boolean,
 *   bubble: string,
 *   showBubble: boolean,
 *   facingLeft: boolean,
 *   position: {x:number,y:number}|null,
 *   crownState: object|null,
 *   crownGlowing: boolean,
 * }}
 */
export function usePmModel({
  mode = 'idle',
  isLeader = false,
  isCasting = false,
  externalQuote = '',
  onQuote = null,
  onCastComplete = null,
  position = null,
  facingLeft = false,
  pmPose = null,
  pmBubble = '',
  ceremonyFacing = null,
  crownState = null,
  crownGlowing = false,
} = {}) {
  // Walk-frame leg swap, shared rAF clock. Freezes during cast so the
  // sprite holds the cast pose cleanly.
  const walkFrame = useFrameToggle(WALK_FRAME_MS, !isCasting);

  // ---- Sparkle one-shot, fired on the leading edge of isCasting --------
  const [showSparkles, setShowSparkles] = useState(false);
  const onCastCompleteRef = useRef(onCastComplete);
  onCastCompleteRef.current = onCastComplete;
  useEffect(() => {
    if (!isCasting) return undefined;
    setShowSparkles(true);
    const id = setTimeout(() => {
      setShowSparkles(false);
      onCastCompleteRef.current?.();
    }, SPARKLE_MS);
    return () => clearTimeout(id);
  }, [isCasting]);

  // ---- Leader thinking loop -------------------------------------------
  // State machine driven by useFrameTicker — each fire flips between
  // 'waiting' (random 5-13s gap) and 'thinking' (random 2.5-4s window).
  // The chained setTimeouts the old PmSprite used became a single ticker
  // sampling MotionRuntime's rAF, so the loop pauses cleanly when the
  // tab is hidden and resumes without burst-firing.
  const [thinkPhase, setThinkPhase] = useState('waiting');
  const [thinkDuration, setThinkDuration] = useState(
    () => WAIT_MIN_MS + Math.random() * WAIT_RANDOM_MS,
  );
  const [quote, setQuote] = useState('');
  const onQuoteRef = useRef(onQuote);
  onQuoteRef.current = onQuote;

  const leaderActive = mode === 'idle' && isLeader && !isCasting;

  // Reset to waiting when leader role / cast / mode changes so we don't
  // resume mid-think after a context switch.
  useEffect(() => {
    if (!leaderActive) {
      if (quote) {
        setQuote('');
        onQuoteRef.current?.('');
      }
      setThinkPhase('waiting');
      setThinkDuration(WAIT_MIN_MS + Math.random() * WAIT_RANDOM_MS);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaderActive]);

  useFrameTicker(
    thinkDuration,
    () => {
      if (thinkPhase === 'waiting') {
        if (Math.random() < QUOTE_CHANCE) {
          const q = pickQuote();
          setQuote(q);
          onQuoteRef.current?.(q);
        } else {
          setQuote('');
          onQuoteRef.current?.('');
        }
        setThinkPhase('thinking');
        setThinkDuration(THINK_MIN_MS + Math.random() * THINK_RANDOM_MS);
      } else {
        setQuote('');
        onQuoteRef.current?.('');
        setThinkPhase('waiting');
        setThinkDuration(WAIT_MIN_MS + Math.random() * WAIT_RANDOM_MS);
      }
    },
    leaderActive,
  );

  // ---- Derived pose / bubble ------------------------------------------
  const isThinking = leaderActive && thinkPhase === 'thinking';
  // Non-leaders pose as thinking whenever there's an externalQuote so the
  // sprite freezes in the "speaking" pose while the quote is on screen.
  const externalSpeaking = mode === 'idle' && !onQuote && !!externalQuote;

  let pose;
  if (mode === 'ceremony') {
    pose = pmPose === 'cast' ? 'cast' : 'walk';
  } else if (isCasting) {
    pose = 'cast';
  } else if (isThinking || externalSpeaking) {
    pose = 'think';
  } else {
    pose = 'walk';
  }

  const idleBubbleText = onQuote ? quote : (externalQuote || '');
  const showIdleBubble = (isThinking && !!quote) || (externalSpeaking && !!externalQuote);

  return {
    mode,
    walkFrame,
    pose,
    showSparkles,
    bubble: mode === 'ceremony' ? pmBubble : idleBubbleText,
    showBubble: mode === 'ceremony' ? !!pmBubble : showIdleBubble,
    facingLeft: mode === 'ceremony' ? ceremonyFacing === 'left' : facingLeft,
    position,
    crownState,
    crownGlowing,
  };
}

// Exported for tests
export const __testing__ = { QUOTES, SPARKLE_MS, QUOTE_CHANCE, WAIT_MIN_MS, THINK_MIN_MS };
