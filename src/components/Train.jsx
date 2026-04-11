import { useState, useEffect, useMemo, useRef } from 'react';
import PlayerFigure from './PlayerFigure';
import { useCinematicHandoff } from '../events/useCinematicHandoff';

const _ = null;
// Shinkansen E5 series colors
const W = '#e8e8e8'; // white body
const L = '#f5f5f5'; // roof
const B = '#16a34a'; // green stripe (E5 is green!)
const D = '#15803d'; // dark green
const K = '#1e293b'; // windows
const R = '#dc2626'; // accent line
const S = '#94a3b8'; // silver undercarriage
const U = '#64748b'; // darker silver
const N = '#334155'; // dark
const C = '#78716c'; // connector
const P = '#d4d4d8'; // panel line
const H = '#f59e0b'; // headlight

// Nose car (aerodynamic): 16w × 12h
const NOSE = [
  [_,_,_,_,_,_,_,_,_,_,_,L,L,L,L,_],
  [_,_,_,_,_,_,_,_,_,_,L,W,W,W,W,L],
  [_,_,_,_,_,_,_,_,_,W,W,W,W,W,W,W],
  [_,_,_,_,_,_,_,_,W,W,K,K,K,P,W,W],
  [_,_,_,_,_,_,R,R,B,B,B,B,B,B,B,B],
  [_,_,_,_,R,R,R,B,B,B,B,B,B,B,B,B],
  [_,_,H,R,R,R,D,D,D,D,D,D,D,D,D,D],
  [_,_,_,R,R,S,S,S,S,S,S,S,S,S,S,S],
  [_,_,_,_,U,U,U,U,U,U,U,U,U,U,U,U],
  [_,_,_,_,_,K,K,_,_,K,K,_,_,K,K,_],
  [_,_,_,_,_,K,K,_,_,K,K,_,_,K,K,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
];

// Middle passenger car: 24w × 12h
const MID = [
  [C,L,L,L,L,L,L,L,L,L,L,L,L,L,L,L,L,L,L,L,L,L,L,C],
  [C,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,C],
  [C,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,W,C],
  [C,W,K,K,K,P,K,K,K,P,K,K,K,P,K,K,K,P,K,K,K,P,W,C],
  [C,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,C],
  [C,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,B,C],
  [C,D,D,D,N,N,D,D,D,D,D,D,D,D,D,D,D,D,N,N,D,D,D,C],
  [C,S,S,S,S,S,S,S,S,S,S,S,S,S,S,S,S,S,S,S,S,S,S,C],
  [_,U,U,U,U,U,U,U,U,U,U,U,U,U,U,U,U,U,U,U,U,U,U,_],
  [_,_,K,K,_,_,K,K,_,_,_,_,_,_,K,K,_,_,K,K,_,_,_,_],
  [_,_,K,K,_,_,K,K,_,_,_,_,_,_,K,K,_,_,K,K,_,_,_,_],
  [_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_,_],
];

const PX = 4;
const NOSE_W = 16 * PX;
const MID_W = 24 * PX;
const CAR_H = 12 * PX;
const NUM_MID = 3;
// Train: nose + 3 mid + nose(flipped)
const TOTAL_W = NOSE_W + MID_W * NUM_MID + NOSE_W;

const pixel = "'Press Start 2P', monospace";

// Tree: 6w × 8h
const TG = '#22c55e';
const TD = '#16a34a';
const TT = '#78350f';
const TREE = [
  [_,_,TG,TG,_,_],
  [_,TG,TD,TG,TG,_],
  [TG,TD,TG,TG,TD,TG],
  [TG,TG,TD,TG,TG,TG],
  [_,TG,TG,TG,TG,_],
  [_,_,TT,TT,_,_],
  [_,_,TT,TT,_,_],
  [_,_,TT,TT,_,_],
];
const TPX = 3;

function spriteToShadows(grid, px, offX = 0) {
  const s = [];
  for (let y = 0; y < grid.length; y++)
    for (let x = 0; x < grid[y].length; x++) {
      const c = grid[y][x];
      if (c) s.push(`${x * px + offX}px ${y * px}px 0 ${Math.ceil(px / 2)}px ${c}`);
    }
  return s;
}

// Flip sprite horizontally
function flipGrid(grid) {
  return grid.map(row => [...row].reverse());
}

export default function Train({ fromRight, playerId, playerName, onPlayerExit, onDone }) {
  const [phase, setPhase] = useState('rails');
  const [showRichard, setShowRichard] = useState(false);
  const [showDust, setShowDust] = useState(false);
  const trainRef = useRef(null);
  const richardRef = useRef(null);

  // Keep latest callbacks in refs so the animation effect doesn't restart on re-render.
  // Previously the effect depended on [onPlayerExit] which was a fresh function on every
  // parent render — every re-render of PlayerList restarted the whole animation, which is
  // why non-owners saw the train arrive twice.
  const onPlayerExitRef = useRef(onPlayerExit);
  const onDoneRef = useRef(onDone);
  useEffect(() => { onPlayerExitRef.current = onPlayerExit; }, [onPlayerExit]);
  useEffect(() => { onDoneRef.current = onDone; }, [onDone]);

  // Handoff hook — drives the continuous walk from train door to grid slot.
  // The placeholder is keyed by the player's session ID, so that's what
  // useCinematicHandoff must query. Unit tests pass only `playerName`; in
  // that case we fall back to using the name as the target key (which is
  // also what the test fixtures use for `data-entrance-target`).
  const targetKey = playerId || playerName;
  const handoff = useCinematicHandoff(
    targetKey,
    richardRef,
    () => onPlayerExitRef.current?.()
  );

  const trainShadow = useMemo(() => {
    const all = [];
    let x = 0;
    // Front nose
    all.push(...spriteToShadows(NOSE, PX, x)); x += NOSE_W;
    // Middle cars
    for (let i = 0; i < NUM_MID; i++) { all.push(...spriteToShadows(MID, PX, x)); x += MID_W; }
    // Rear nose (flipped)
    all.push(...spriteToShadows(flipGrid(NOSE), PX, x));
    return all.join(',');
  }, []);

  const treeShadow = useMemo(() => spriteToShadows(TREE, TPX).join(','), []);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase('arrive'), 800),
      setTimeout(() => setPhase('stopped'), 3800),
      setTimeout(() => setPhase('bubble'), 4200),
      // Richard steps out; mount the cinematic figure at the train door.
      setTimeout(() => { setPhase('exit'); setShowRichard(true); }, 6500),
      // One frame later, start the handoff walk-to-slot. The hook measures
      // both rects, computes a distance-scaled duration, and the CSS
      // transition carries Richard from the train door all the way to his
      // reserved grid slot in a single continuous motion.
      setTimeout(() => { handoff.startHandoff(); }, 6550),
      // Train departs while Richard is still walking toward the grid.
      setTimeout(() => setPhase('depart'), 8500),
      // Dust puff kicks up ~400ms before arrival.
      setTimeout(() => setShowDust(true), 8700),
      // Arrival: tell the parent Richard has taken his seat, then unmount
      // our cinematic figure on the next frame. finishHandoff flips the
      // placeholder to visible first (via onPlayerExit → markArrived),
      // so the grid figure appears exactly where our cinematic figure
      // currently sits — no teleport.
      setTimeout(() => {
        handoff.finishHandoff().then(() => {
          setShowRichard(false);
          setShowDust(false);
        });
      }, 9100),
      // Rails fade
      setTimeout(() => setPhase('fadeRails'), 10500),
      // Full cleanup — tell parent to unmount
      setTimeout(() => { setPhase('done'); onDoneRef.current?.(); }, 11500),
    ];
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (phase === 'done') return null;

  const showTrain = !['rails', 'fadeRails', 'done'].includes(phase);
  const railsFading = phase === 'fadeRails';
  const stopX = `calc(50% - ${TOTAL_W / 2}px)`;
  const trees = [40, 140, 280, 420, 560, 700];

  return (
    <div style={styles.container} data-testid="train-backdrop">
      <div style={styles.trainArea}>
        {/* Trees */}
        {trees.map((tx, i) => (
          <div key={i} style={{
            position: 'absolute', bottom: 18, left: tx, width: 1, height: 1,
            boxShadow: treeShadow, zIndex: 0,
            opacity: railsFading ? 0 : 1, transition: 'opacity 0.8s',
          }} />
        ))}

        {/* Bubble — always rendered during the arrival window, fades out
            when Richard starts walking so the eye follows him up. */}
        {(phase === 'stopped' || phase === 'bubble' || phase === 'exit') && (
          <div style={{
            ...styles.bubble,
            opacity: phase === 'bubble' ? 1 : 0,
            transition: 'opacity 250ms steps(4, end)',
          }}>
            🚄 {playerName}: Monorepo conductor has arrived 🚄
          </div>
        )}

        {/* Richard — walks continuously from train door to his grid slot.
            The outer div is position:fixed so `getBoundingClientRect` is
            measured in viewport coordinates (matching the grid placeholder),
            and its `transform` + `transition` are set by useCinematicHandoff. */}
        {showRichard && (
          <div
            ref={richardRef}
            className="richard-exit-train"
            style={{
              position: 'fixed',
              bottom: 210 + CAR_H + 16, /* container bottom + train height + gap */
              left: '50%',
              marginLeft: '-30px',
              zIndex: 185,
              transform: handoff.transform,
              transition: `transform ${handoff.duration}ms steps(${handoff.stepCount}, end)`,
            }}
          >
            <PlayerFigure
              name={playerName}
              holdingCard={false}
              walkFrame={handoff.walkFrame}
            />
            {showDust && <div className="dust-puff" />}
          </div>
        )}

        {/* Train */}
        {showTrain && (
          <div
            ref={trainRef}
            style={{
              ...styles.train, width: TOTAL_W,
              transform: fromRight ? 'scaleX(-1)' : 'scaleX(1)',
              ...(phase === 'arrive' ? {
                animation: `trainArrive${fromRight ? 'Right' : 'Left'} 3s ease-out forwards`,
              } : phase === 'depart' ? {
                animation: `trainDepart${fromRight ? 'Right' : 'Left'} 2.5s ease-in forwards`,
              } : { left: stopX }),
            }}
          >
            <div style={{ width: 1, height: 1, boxShadow: trainShadow, position: 'absolute', top: 0, left: 0 }} />
          </div>
        )}

        {/* Rails */}
        <div style={{ ...styles.rails, opacity: railsFading ? 0 : 1, transition: 'opacity 0.8s' }}>
          <div style={styles.ties} />
          <div style={{ ...styles.railLine, top: 2 }} />
          <div style={{ ...styles.railLine, top: 12 }} />
        </div>
      </div>
    </div>
  );
}

const styles = {
  // No backdrop — the regular room UI stays fully visible. The rails and
  // train float high enough on the screen that they don't collide with
  // the bottom UI strip (CardPicker + wizard walk path + pmBar ≈ 280 px).
  container: {
    position: 'fixed', bottom: 210, left: 0, right: 0,
    height: `${CAR_H + 90}px`,
    zIndex: 180, pointerEvents: 'none',
  },
  trainArea: {
    position: 'absolute', inset: 0,
  },
  train: { position: 'absolute', height: CAR_H, bottom: 16, zIndex: 2 },
  bubble: {
    position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
    background: '#fff', border: '3px solid #dc2626', padding: '8px 16px',
    fontSize: '0.65rem', fontFamily: pixel, color: '#1e293b',
    maxWidth: '80vw', textAlign: 'center', boxShadow: '4px 4px 0 #991b1b', zIndex: 10,
  },
  rails: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 16, zIndex: 1,
  },
  railLine: {
    position: 'absolute', left: 0, right: 0, height: 3, background: '#71717a', borderRadius: 1,
  },
  ties: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 16,
    backgroundImage: 'repeating-linear-gradient(90deg, #78350f 0px, #78350f 8px, transparent 8px, transparent 22px)',
  },
};
