import { useEffect, useMemo, useRef } from 'react';
import { pixel } from './room/styles';
import {
  NOSE, MID, TREE,
  STATION_SIGN, STEAM_CLOUD, SIGNAL_LAMP_GREEN, SIGNAL_LAMP_RED, PANTOGRAPH,
  PX, TPX, NOSE_W, MID_W, CAR_H, NUM_MID, TOTAL_W,
  spriteToShadows, flipGrid,
} from '../sprites/trainSprites';
import { trainDoorPosition } from '../events/useEntranceDirector';
import { useEventTimeline, timelinePhase } from '../engine/useEventTimeline';
import { getMotionMode } from '../engine/motionProbe';
import { envelope } from '../engine/motionStyle';

export default function Train({ fromRight, playerId, playerName, onPlayerExit, onDone, entranceDirector, timestamp }) {
  const fired = useRef(new Set());
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

  const elapsed = useEventTimeline(timestamp, 13500, time => {
    if (time >= 7000 && !fired.current.has('exit')) {
      fired.current.add('exit');
      directorRef.current?.walkFromDoor({
        playerId: richardId, door: trainDoorPosition(),
        elapsed: Math.max(0, time - 7000),
      });
    }
    if (time >= 10600 && !fired.current.has('arrived')) {
      fired.current.add('arrived');
      if (!directorRef.current) onPlayerExitRef.current?.();
    }
    if (time >= 13500 && !fired.current.has('done')) {
      fired.current.add('done');
      onDoneRef.current?.();
    }
  });
  const phase = timelinePhase(elapsed, [
    [0, 'rails'], [400, 'approach'], [1200, 'horn'], [1800, 'arrive'],
    [4800, 'stopped'], [5100, 'doorsOpen'], [5400, 'bubble'], [7000, 'exit'],
    [9000, 'wave'], [10000, 'depart'], [12500, 'fadeRails'], [13500, 'done'],
  ]);
  const showDust = elapsed >= 10200 && elapsed < 10600;
  const signalRed = Math.floor(elapsed / 400) % 2 === 1;
  const vw = typeof window === 'undefined' ? 1440 : window.innerWidth;
  const stopLeft = (vw - TOTAL_W) / 2;
  const arrival = Math.max(0, Math.min(1, (elapsed - 1800) / 3000));
  const departure = Math.max(0, Math.min(1, (elapsed - 10000) / 2500));
  const offLeft = fromRight ? vw + TOTAL_W : -TOTAL_W;
  const exitLeft = fromRight ? -TOTAL_W : vw + TOTAL_W;
  const trainX = elapsed < 4800
    ? offLeft + (stopLeft - offLeft) * (1 - (1 - arrival) ** 3)
    : stopLeft + (exitLeft - stopLeft) * departure ** 3;

  if (phase === 'done') return null;

  const beforeArrive = ['rails', 'approach', 'horn'].includes(phase);
  const showTrain = !['rails', 'fadeRails', 'done'].includes(phase) && !beforeArrive;
  const railsFading = phase === 'fadeRails';
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
    <div style={{ ...styles.container, opacity: envelope(elapsed, 13500, 400, 850) }} data-testid="train-backdrop">
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
            transition: 'opacity 250ms ease-out',
          }}>
            {playerName}: Monorepo conductor has arrived
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
            data-train-motion
            style={{
              ...styles.train, width: TOTAL_W,
              left: 0,
              transform: `translateX(${trainX}px) scaleX(${fromRight ? -1 : 1})`,
              visibility: getMotionMode() === 'reduced' ? 'hidden' : 'visible',

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
    background: '#f5f0e4', border: '3px solid #2c3e50', padding: '10px 16px',
    fontSize: '0.65rem', fontFamily: pixel, color: '#1e293b',
    width: 'min(420px, calc(100vw - 32px))', lineHeight: 1.8, textAlign: 'center', boxShadow: '4px 4px 0 #b8922e', zIndex: 10,
  },
  hornBubble: {
    position: 'absolute',
    top: 8,
    transform: 'translateX(-50%)',
    background: '#fff',
    border: '3px solid #2c3e50',
    padding: '4px 10px',
    fontSize: '0.6rem',
    fontFamily: pixel,
    color: '#c0392b',
    boxShadow: '3px 3px 0 #b8922e',
    zIndex: 11,
    letterSpacing: '1px',
  },
  waveBubble: {
    position: 'absolute',
    top: 12,
    transform: 'translateX(-50%)',
    background: '#fff',
    border: '3px solid #2c3e50',
    padding: '4px 10px',
    fontSize: '0.6rem',
    fontFamily: pixel,
    color: '#2c3e50',
    boxShadow: '3px 3px 0 #b8922e',
    zIndex: 11,
  },
  doorFlash: {
    position: 'absolute',
    width: 40,
    height: 32,
    background: '#fef3c7',
    boxShadow: '0 0 0 4px #f5c542',
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
