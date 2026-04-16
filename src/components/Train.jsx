import { useState, useEffect, useMemo, useRef } from 'react';
import { pixel } from './room/styles';
import {
  NOSE, MID, TREE,
  PX, TPX, NOSE_W, MID_W, CAR_H, NUM_MID, TOTAL_W,
  spriteToShadows, flipGrid,
} from '../sprites/trainSprites';
import { trainDoorPosition } from '../events/useEntranceDirector';

export default function Train({ fromRight, playerId, playerName, onPlayerExit, onDone, entranceDirector }) {
  const [phase, setPhase] = useState('rails');
  const [showDust, setShowDust] = useState(false);
  const trainRef = useRef(null);

  // Keep latest callbacks in refs so the animation effect doesn't restart on re-render.
  // Previously the effect depended on [onPlayerExit] which was a fresh function on every
  // parent render — every re-render of PlayerList restarted the whole animation, which is
  // why non-owners saw the train arrive twice.
  const onPlayerExitRef = useRef(onPlayerExit);
  const onDoneRef = useRef(onDone);
  const directorRef = useRef(entranceDirector);
  useEffect(() => { onPlayerExitRef.current = onPlayerExit; }, [onPlayerExit]);
  useEffect(() => { onDoneRef.current = onDone; }, [onDone]);
  useEffect(() => { directorRef.current = entranceDirector; }, [entranceDirector]);

  // Richard's character lives on the shared CharacterStage — the entrance
  // director teleports it to the train door and walks it to its grid slot
  // at the "exit" beat. No more per-component PlayerFigure, no more
  // `getBoundingClientRect` on an in-flight transition.
  const richardId = playerId || playerName;

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
      // Richard steps out — the entrance director teleports his persistent
      // character to the train door and starts its walk to the grid slot.
      setTimeout(() => {
        setPhase('exit');
        const door = trainDoorPosition();
        directorRef.current?.walkFromDoor({
          playerId: richardId,
          door,
          onArrived: () => onPlayerExitRef.current?.(),
        });
      }, 6500),
      // Train departs while Richard is still walking toward the grid.
      setTimeout(() => setPhase('depart'), 8500),
      // Dust puff kicks up ~400ms before arrival.
      setTimeout(() => setShowDust(true), 8700),
      // Arrival. The director's walkTo onDone also calls markArrived, but
      // we fire onPlayerExit here too (idempotent in production) so unit
      // tests that mount Train without a stage still observe the call.
      setTimeout(() => {
        setShowDust(false);
        onPlayerExitRef.current?.();
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

        {/* Richard's figure is drawn by the shared CharacterStage —
            the dust puff still renders here, anchored at the door. */}
        {showDust && (
          <div
            style={{
              position: 'fixed',
              bottom: 210 + CAR_H + 16,
              left: '50%',
              marginLeft: '-30px',
              zIndex: 185,
              pointerEvents: 'none',
            }}
          >
            <div className="dust-puff" />
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
  // the bottom UI strip (CardPicker + PM walk path + pmBar ≈ 280 px).
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
