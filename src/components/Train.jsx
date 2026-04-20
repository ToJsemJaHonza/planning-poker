import { useState, useEffect, useMemo, useRef } from 'react';
import { pixel } from './room/styles';
import {
  NOSE, MID, TREE,
  STATION_SIGN, STEAM_CLOUD, SIGNAL_LAMP_GREEN, SIGNAL_LAMP_RED, PANTOGRAPH,
  PX, TPX, NOSE_W, MID_W, CAR_H, NUM_MID, TOTAL_W,
  spriteToShadows, flipGrid,
} from '../sprites/trainSprites';
import { trainDoorPosition } from '../events/useEntranceDirector';

export default function Train({ fromRight, playerId, playerName, onPlayerExit, onDone, entranceDirector }) {
  const [phase, setPhase] = useState('rails');
  const [showDust, setShowDust] = useState(false);
  const [signalRed, setSignalRed] = useState(false);
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
  const stationShadow = useMemo(() => spriteToShadows(STATION_SIGN, 3).join(','), []);
  const steamShadow = useMemo(() => spriteToShadows(STEAM_CLOUD, 3).join(','), []);
  const signalGreenShadow = useMemo(() => spriteToShadows(SIGNAL_LAMP_GREEN, 3).join(','), []);
  const signalRedShadow = useMemo(() => spriteToShadows(SIGNAL_LAMP_RED, 3).join(','), []);
  const pantographShadow = useMemo(() => spriteToShadows(PANTOGRAPH, 3).join(','), []);

  useEffect(() => {
    const timers = [
      // t=400: station sign slides into view; signal lamp starts blinking
      setTimeout(() => setPhase('approach'), 400),
      // t=1200: horn beat (600 ms) — train not yet in frame, but we hear it arriving
      setTimeout(() => setPhase('horn'), 1200),
      // t=1800: train slides in (3 s arrival animation)
      setTimeout(() => setPhase('arrive'), 1800),
      // t=4800: fully stopped
      setTimeout(() => setPhase('stopped'), 4800),
      // t=5100: doors open — 300 ms white flash at door line
      setTimeout(() => setPhase('doorsOpen'), 5100),
      // t=5400: speech bubble above train
      setTimeout(() => setPhase('bubble'), 5400),
      // t=7000: Richard steps out — the entrance director teleports his persistent
      // character to the train door and starts its walk to the grid slot.
      setTimeout(() => {
        setPhase('exit');
        const door = trainDoorPosition();
        directorRef.current?.walkFromDoor({
          playerId: richardId,
          door,
          onArrived: () => onPlayerExitRef.current?.(),
        });
      }, 7000),
      // t=9000: wave beat — Richard gives the train a goodbye wave
      setTimeout(() => setPhase('wave'), 9000),
      // t=10000: train departs (2.5 s depart animation)
      setTimeout(() => setPhase('depart'), 10000),
      // t=10200: dust puff kicks up ~400 ms before arrival fires
      setTimeout(() => setShowDust(true), 10200),
      // t=10600: arrival — the director's walkTo onDone also calls markArrived,
      // but we fire onPlayerExit here too (idempotent) so unit tests without a
      // stage still observe the call.
      setTimeout(() => {
        setShowDust(false);
        onPlayerExitRef.current?.();
      }, 10600),
      // t=12500: rails fade
      setTimeout(() => setPhase('fadeRails'), 12500),
      // t=13500: full cleanup — tell parent to unmount
      setTimeout(() => { setPhase('done'); onDoneRef.current?.(); }, 13500),
    ];
    // Signal lamp blink: alternate every 400 ms from approach until depart
    const blinkInterval = setInterval(() => setSignalRed((r) => !r), 400);
    return () => {
      timers.forEach(clearTimeout);
      clearInterval(blinkInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (phase === 'done') return null;

  const beforeArrive = ['rails', 'approach', 'horn'].includes(phase);
  const showTrain = !['rails', 'fadeRails', 'done'].includes(phase) && !beforeArrive;
  const railsFading = phase === 'fadeRails';
  const stopX = `calc(50% - ${TOTAL_W / 2}px)`;
  const trees = [40, 140, 280, 420, 560, 700];

  // Station sign + signal lamp are visible from `approach` until `depart` begins.
  const stationVisible = !['rails', 'fadeRails', 'done'].includes(phase);

  // Horn bubble and steam cloud appear at the `horn` beat and briefly linger.
  const showHornFx = phase === 'horn';

  // Door flash appears for 300 ms during `doorsOpen`.
  const showDoorFlash = phase === 'doorsOpen';

  // Wave bubble: small "またね！" near the window as Richard waves goodbye.
  const showWaveFx = phase === 'wave' || phase === 'depart';

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

        {/* Station sign (TOKYO-style post) — slides into view during approach. */}
        {stationVisible && (
          <div
            data-testid="train-station-sign"
            className="train-station-sign"
            style={{
              position: 'absolute',
              bottom: 32,
              left: 60,
              width: 1,
              height: 1,
              boxShadow: stationShadow,
              zIndex: 1,
              opacity: railsFading ? 0 : 1,
              transition: 'opacity 0.8s',
            }}
          />
        )}

        {/* Signal lamp — blinks green/red during approach. */}
        {stationVisible && (
          <div
            data-testid="train-signal-lamp"
            style={{
              position: 'absolute',
              bottom: 54,
              left: 120,
              width: 1,
              height: 1,
              boxShadow: signalRed ? signalRedShadow : signalGreenShadow,
              zIndex: 1,
              opacity: railsFading ? 0 : 1,
              transition: 'opacity 0.8s',
            }}
          />
        )}

        {/* Horn steam puff + bubble — briefly visible at the horn beat */}
        {showHornFx && (
          <>
            <div
              className="train-steam-cloud"
              data-testid="train-steam-cloud"
              style={{
                position: 'absolute',
                bottom: 80,
                left: fromRight ? '78%' : '22%',
                width: 1,
                height: 1,
                boxShadow: steamShadow,
                zIndex: 3,
              }}
            />
            <div
              className="horn-bubble"
              data-testid="train-horn-bubble"
              style={{
                ...styles.hornBubble,
                left: fromRight ? '82%' : '18%',
              }}
            >
              ＨＯＯＯＮ—！
            </div>
          </>
        )}

        {/* Door opening flash — 300 ms */}
        {showDoorFlash && (
          <div
            className="door-flash"
            data-testid="train-door-flash"
            style={{
              ...styles.doorFlash,
              left: `calc(50% - 20px)`,
              bottom: 210 - 200 + 16 + CAR_H / 2 - 16,
            }}
          />
        )}

        {/* Bubble — always rendered during the arrival window, fades out
            when Richard starts walking so the eye follows him up. */}
        {(phase === 'stopped' || phase === 'bubble' || phase === 'exit' || phase === 'doorsOpen') && (
          <div style={{
            ...styles.bubble,
            opacity: phase === 'bubble' ? 1 : 0,
            transition: 'opacity 250ms steps(4, end)',
          }}>
            🚄 {playerName}: Monorepo conductor has arrived 🚄
          </div>
        )}

        {/* Wave bubble — small goodbye near train window */}
        {showWaveFx && (
          <div
            className="richard-wave"
            data-testid="train-wave-bubble"
            style={{
              ...styles.waveBubble,
              left: `calc(50% + ${fromRight ? -120 : 120}px)`,
            }}
          >
            またね！
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
            {/* Pantograph decorations — one per mid car, sitting on the roof.
                Rendered inside the train group so they slide with the cars. */}
            {[0, 1, 2].map((i) => (
              <div
                key={`pantograph-${i}`}
                data-testid="train-pantograph"
                style={{
                  position: 'absolute',
                  top: -15,
                  left: NOSE_W + i * MID_W + MID_W / 2 - 20,
                  width: 1,
                  height: 1,
                  boxShadow: pantographShadow,
                  zIndex: 2,
                }}
              />
            ))}
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
  hornBubble: {
    position: 'absolute',
    top: 8,
    transform: 'translateX(-50%)',
    background: '#fff',
    border: '3px solid #dc2626',
    padding: '4px 10px',
    fontSize: '0.6rem',
    fontFamily: pixel,
    color: '#b91c1c',
    boxShadow: '3px 3px 0 #7f1d1d',
    zIndex: 11,
    letterSpacing: '1px',
  },
  waveBubble: {
    position: 'absolute',
    top: 12,
    transform: 'translateX(-50%)',
    background: '#fff',
    border: '3px solid #16a34a',
    padding: '4px 10px',
    fontSize: '0.6rem',
    fontFamily: pixel,
    color: '#15803d',
    boxShadow: '3px 3px 0 #14532d',
    zIndex: 11,
  },
  doorFlash: {
    position: 'absolute',
    width: 40,
    height: 32,
    background: '#fef3c7',
    boxShadow: '0 0 16px 8px rgba(254,243,199,0.75)',
    zIndex: 3,
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
