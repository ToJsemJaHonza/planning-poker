import { useMemo } from 'react';
import SlotReel from './SlotReel';
import { precomputeReelOrders } from '../events/slotMachine';
import { pixel } from './room/styles';

/**
 * SlotMachine -- the cabinet visual. Pure, dumb renderer. Consumes the
 * phase state from `useSlotMachine` and the ceremony payload. Builds the
 * three reels once per ceremony via the deterministic seeded shuffle.
 *
 * Features: winner reel-pair matching, connecting bar between matching reels,
 * triple jackpot sparkle burst, pulse glow during matched-hold phase.
 */

const CABINET_W = 560;
const CABINET_H = 340;

const OUTLINE = '#0a0b11';
const NAVY = '#2c3e6b';
const NAVY_DARK = '#1a2540';
const NAVY_HILIGHT = '#4a5b8c';
const GOLD_P = '#d4a853';
const GOLD_B = '#f5c542';
const GOLD_S = '#b8922e';
const GOLD_DEEP = '#8a6a1f';
const REEL_BG = '#1e293b';
const NEARMISS_RED = '#c0392b';
const PARCHMENT = '#f5f0e4';
const SLOT_W = 140; // matches SlotReel SLOT_W

// Sparkle positions for triple jackpot (4 per reel frame, at corners)
const SPARKLE_POSITIONS = [
  { x: -5, y: -5, dx: -18, dy: -25 },
  { x: SLOT_W + 5, y: -5, dx: 18, dy: -25 },
  { x: -5, y: 125, dx: -18, dy: 25 },
  { x: SLOT_W + 5, y: 125, dx: 18, dy: 25 },
];

const MARQUEE_TEXTS = {
  choosing: 'THE COUNCIL IS CHOOSING',
  rising: 'A NEW LEADER RISES',
  hailing: 'ALL HAIL THE NEW PM',
  compressed: "YOU'RE THE LAST ONE STANDING",
  tripleJackpot: 'TRIPLE JACKPOT!',
};

export default function SlotMachine({ phaseState, ceremony, players }) {
  // Build the 3 reel orders once per ceremony ID. Uses winnerReelPair
  // to place winner or nonMatch in reels 0/1, winner/near-miss in reel 2.
  const { reelOrders } = useMemo(
    () => precomputeReelOrders(ceremony),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ceremony?.ceremonyId],
  );

  // Select marquee text based on ceremony phase
  const marqueeText = useMemo(() => {
    if (!phaseState || !ceremony) return '';
    return MARQUEE_TEXTS[phaseState.marqueeText] || MARQUEE_TEXTS.choosing;
  }, [phaseState, ceremony]);

  // All hooks called above this line — safe to early-return now.
  if (!ceremony) return null;

  const winnerIndexInReel2 = reelOrders[2]?.indexOf(ceremony.winnerId);

  const cabinetClass =
    phaseState.cabinetTransform === 'entering' ? 'cm-cabinet-drop'
    : phaseState.cabinetTransform === 'bounced' ? 'cm-cabinet-bounce'
    : phaseState.cabinetTransform === 'exiting' ? 'cm-cabinet-exit'
    : phaseState.cabinetTransform === 'rumbling' ? 'cm-cabinet-rumble'
    : '';

  const cabinetStyle = {
    ...styles.cabinet,
    opacity: phaseState.cabinetTransform === 'offscreen' || phaseState.cabinetTransform === 'gone' ? 0 : 1,
  };

  const showStreak = phaseState.phase === 'spinning'
    || (phaseState.phase === 'matchedHold' && phaseState.reel3StillSpinning);

  // Bulbs: 8 across. Pattern drives the `lit` boolean per bulb.
  const bulbLit = computeBulbs(phaseState);

  return (
    <div className={`cm-cabinet-wrap ${cabinetClass}`} style={cabinetStyle}>
      {/* Cabinet housing */}
      <div style={styles.housing}>
        {/* Marquee bar */}
        <div style={styles.marquee}>
          <span style={styles.marqueeText} data-cm-marquee>{marqueeText}</span>
        </div>

        {/* Bulb row */}
        <div style={styles.bulbRow}>
          {bulbLit.map((lit, i) => (
            <div
              key={i}
              style={{
                ...styles.bulb,
                ...(lit ? styles.bulbLit : styles.bulbUnlit),
              }}
            />
          ))}
        </div>

        {/* Reel window */}
        <div style={styles.reelWindow}>
          {[0, 1, 2].map((reelIndex) => (
            <SlotReel
              key={reelIndex}
              reelIndex={reelIndex}
              entries={reelOrders[reelIndex]}
              players={players}
              candidateNames={ceremony.candidateNames || {}}
              reelState={phaseState.reelStates[reelIndex]}
              isWinnerReel={reelIndex === 2}
              winnerIndex={winnerIndexInReel2}
              winnerEmphasis={phaseState.winnerEmphasis}
              showStreak={reelIndex === 2 ? showStreak : (phaseState.phase === 'spinning')}
              matchedHoldActive={phaseState.matchedHoldActive}
            />
          ))}
        </div>

        {/* Connecting bar between matching reels during match confirmation */}
        {phaseState.matchConfirmed && (
          <div style={{
            position: 'absolute',
            top: 70 + 60, // reelWindow.top + center of reel
            left: 30 + 20 + (Math.min(...phaseState.matchConfirmed.reels) * (SLOT_W + 10)),
            width: (Math.max(...phaseState.matchConfirmed.reels) - Math.min(...phaseState.matchConfirmed.reels)) * (SLOT_W + 10) + SLOT_W,
            height: 3,
            background: GOLD_B,
            zIndex: 6,
            pointerEvents: 'none',
          }} data-cm-match-bar />
        )}

        {/* Triple jackpot sparkle burst on all 3 reel frames */}
        {phaseState.isTripleJackpot && phaseState.matchConfirmed?.isTriple && (
          [0, 1, 2].map(ri => (
            SPARKLE_POSITIONS.map((pos, si) => (
              <span
                key={`sparkle-${ri}-${si}`}
                className="sparkle-burst"
                style={{
                  position: 'absolute',
                  top: 70 + pos.y,
                  left: 30 + 20 + ri * (SLOT_W + 10) + pos.x,
                  fontSize: 14,
                  color: GOLD_B,
                  pointerEvents: 'none',
                  zIndex: 7,
                  animation: 'sparkle-burst 1.2s ease-out forwards',
                  '--dx': `${pos.dx}px`,
                  '--dy': `${pos.dy}px`,
                  animationDelay: `${si * 0.05}s`,
                }}
              >
                {'\u2726'}
              </span>
            ))
          ))
        )}

        {/* Pull handle */}
        <div style={styles.pullHandle}>
          <div style={styles.pullBar} />
          <div style={styles.pullBall}>
            <div style={styles.pullBallHilight} />
          </div>
        </div>

        {/* Footer credits */}
        <div style={styles.footer}>
          <div style={styles.coinSlot} />
          <div style={styles.coinSlot} />
          <span style={styles.creditsText}>CREDITS: 999</span>
        </div>
      </div>

      {/* Dust puffs fire when cabinet bounces */}
      {phaseState.cabinetTransform === 'bounced' && (
        <>
          <div className="dust-puff" style={styles.dustLeft} />
          <div className="dust-puff" style={styles.dustRight} />
        </>
      )}
    </div>
  );
}

// Compute which of the 8 bulbs should be lit for the current phase pattern.
function computeBulbs(phaseState) {
  const result = new Array(8).fill(false);
  if (!phaseState) return result;

  switch (phaseState.bulbPattern) {
    case 'dark':
      return result;
    case 'allLit':
      return result.map(() => true);
    case 'slowPulse': {
      const on = Math.floor(phaseState.elapsed / 800) % 2 === 0;
      return result.map(() => on);
    }
    case 'fastPulse': {
      const on = Math.floor(phaseState.elapsed / 200) % 2 === 0;
      return result.map(() => on);
    }
    case 'chase':
    default: {
      const step = Math.floor(phaseState.elapsed / 120) % 8;
      for (let i = 0; i < 8; i++) {
        if (i === step || i === (step + 1) % 8 || i === (step + 2) % 8) {
          result[i] = true;
        }
      }
      return result;
    }
  }
}

const styles = {
  cabinet: {
    position: 'absolute',
    left: '50%',
    top: '45%',
    width: CABINET_W,
    height: CABINET_H,
    transform: 'translate(-50%, -50%)',
    pointerEvents: 'none',
    zIndex: 210,
    transition: 'opacity 200ms steps(3, end)',
  },
  housing: {
    position: 'relative',
    width: '100%',
    height: '100%',
    background: NAVY,
    boxShadow: [
      `inset 0 5px 0 0 ${OUTLINE}`,
      `inset 0 10px 0 0 ${NAVY_HILIGHT}`,
      `inset 0 -5px 0 0 ${OUTLINE}`,
      `inset 0 -15px 0 0 ${NAVY_DARK}`,
      `0 0 0 5px ${OUTLINE}`,
      `8px 8px 0 ${NAVY_DARK}`,
    ].join(','),
    imageRendering: 'pixelated',
  },
  marquee: {
    position: 'absolute',
    top: 5,
    left: 30,
    right: 30,
    height: 24,
    background: '#1e293b',
    borderTop: `3px solid ${GOLD_P}`,
    borderBottom: `3px solid ${GOLD_P}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 4,
  },
  marqueeText: {
    fontSize: '0.65rem',
    fontFamily: pixel,
    color: GOLD_P,
    letterSpacing: 3,
    textShadow: '2px 2px 0 #0a0b11',
  },
  bulbRow: {
    position: 'absolute',
    top: 34,
    left: 40,
    right: 40,
    height: 20,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 4,
  },
  bulb: {
    width: 14,
    height: 14,
    boxShadow: `2px 2px 0 ${OUTLINE}`,
    imageRendering: 'pixelated',
  },
  bulbUnlit: {
    background: GOLD_S,
    boxShadow: [
      `inset 2px 2px 0 0 ${GOLD_P}`,
      `inset -2px -2px 0 0 ${GOLD_DEEP}`,
      `2px 2px 0 ${OUTLINE}`,
    ].join(','),
  },
  bulbLit: {
    background: GOLD_B,
    boxShadow: [
      `inset 2px 2px 0 0 #fff3`,
      `inset -1px -1px 0 0 ${GOLD_P}`,
      `0 0 0 2px ${GOLD_P}`,
      `3px 3px 0 ${OUTLINE}`,
    ].join(','),
  },
  reelWindow: {
    position: 'absolute',
    top: 70,
    left: 30,
    right: 30,
    height: 200,
    background: REEL_BG,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '12px 20px',
    boxShadow: [
      `inset 0 0 0 4px ${GOLD_P}`,
      `inset 0 0 0 6px ${GOLD_S}`,
      `inset 5px 5px 0 ${OUTLINE}`,
    ].join(','),
    zIndex: 3,
  },
  pullHandle: {
    position: 'absolute',
    right: -40,
    top: 80,
    width: 40,
    height: 140,
    zIndex: 5,
  },
  pullBar: {
    position: 'absolute',
    top: 30,
    left: 8,
    width: 20,
    height: 100,
    background: NAVY_HILIGHT,
    boxShadow: `0 0 0 4px ${OUTLINE}`,
  },
  pullBall: {
    position: 'absolute',
    top: 0,
    left: 3,
    width: 30,
    height: 30,
    background: NEARMISS_RED,
    boxShadow: `0 0 0 4px ${OUTLINE}`,
    borderRadius: 0,
  },
  pullBallHilight: {
    position: 'absolute',
    top: 4,
    left: 4,
    width: 4,
    height: 4,
    background: PARCHMENT,
  },
  footer: {
    position: 'absolute',
    bottom: 5,
    left: 30,
    right: 30,
    height: 24,
    background: NAVY_DARK,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    padding: '0 10px',
    gap: 6,
  },
  coinSlot: {
    width: 6,
    height: 10,
    background: '#000',
    marginRight: 4,
    boxShadow: `inset 0 0 0 1px ${NAVY_HILIGHT}`,
  },
  creditsText: {
    fontSize: '0.45rem',
    fontFamily: pixel,
    color: GOLD_S,
    letterSpacing: 1,
    marginLeft: 'auto',
  },
  dustLeft: {
    position: 'absolute',
    bottom: -4,
    left: 20,
  },
  dustRight: {
    position: 'absolute',
    bottom: -4,
    right: 20,
    left: 'auto',
  },
};
