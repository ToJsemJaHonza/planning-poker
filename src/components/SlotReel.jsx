import { useMemo } from 'react';
import PlayerFigure from './PlayerFigure';
import SlotFiller from './SlotFiller';
import Crown from './Crown';
import { isFillerKey } from '../events/slotMachine';
import { pixel } from './room/styles';

/**
 * SlotReel -- one of three vertical reels inside the slot-machine cabinet.
 *
 * The ribbon is a full-length vertical column containing ALL pool entries.
 * The ribbon's `transform: translateY()` is the animated property -- it
 * changes when `currentIndex` changes. CSS `transition` drives the animation.
 *
 * Three transition modes:
 *   - 'click': 60ms stepped snap (reel clicking through entries)
 *   - 'nudge': 440ms smooth ease (near-miss -> winner nudge)
 *   - 'none': no transition (full-speed spin)
 */

const SLOT_W = 140;
const SLOT_H = 120;

export { SLOT_W as REEL_SLOT_W, SLOT_H as REEL_SLOT_H };

// For ghost figures we render at the same scale but lower opacity.
const GHOST_STYLE = { opacity: 0.4, filter: 'none' };

function renderSlotContent(entry, players, candidateNames) {
  if (isFillerKey(entry)) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <SlotFiller typeKey={entry} />
      </div>
    );
  }
  // entry is a player ID.
  const live = players?.[entry];
  const displayName = live?.name || candidateNames?.[entry] || entry;
  const isGhost = !live;
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        ...(isGhost ? GHOST_STYLE : {}),
      }}
    >
      <div style={{ marginTop: 6 }}>
        <PlayerFigure
          name={displayName}
          holdingCard={false}
          fukEyes={false}
        />
      </div>
      <div style={styles.slotName}>
        {displayName.slice(0, 12)}
      </div>
    </div>
  );
}

export default function SlotReel({
  reelIndex,
  entries,
  players,
  candidateNames,
  reelState,
  isWinnerReel,
  winnerIndex,
  winnerEmphasis,
  showStreak,
  matchedHoldActive,
}) {
  const len = entries.length;
  const rawIndex = reelState?.currentIndex ?? 0;
  const clampedIndex = len === 0 ? 0 : ((rawIndex % len) + len) % len;

  const transitionMode = reelState?.transitionMode || 'none';
  const nudgeProgress = reelState?.nudgeProgress;
  const isNudging = transitionMode === 'nudge' || (typeof nudgeProgress === 'number' && nudgeProgress < 1);

  const pulseActive = reelState?.pulseActive || false;
  const dimmed = reelState?.dimmed || false;
  const ribbonY = -(clampedIndex * SLOT_H);

  // Select CSS transition based on mode
  let ribbonTransition = 'none';
  if (transitionMode === 'nudge') {
    ribbonTransition = 'transform 440ms cubic-bezier(0.4, 0.0, 0.2, 1)';
  } else if (transitionMode === 'click') {
    ribbonTransition = 'transform 60ms steps(2, end)';
  }

  // Memoize the full entry list (all pool entries)
  const allEntries = useMemo(() => {
    return entries.map((entry, idx) => ({ entry, idx }));
  }, [entries]);

  const winnerActive = isWinnerReel && reelState?.stopped && !isNudging && winnerIndex != null && clampedIndex === winnerIndex;
  const emphasize = winnerActive && (winnerEmphasis === 'beat2' || winnerEmphasis === 'crowned');
  const crowned = winnerActive && winnerEmphasis === 'crowned';
  const nearMissActive = isWinnerReel && reelState?.nearMissHold;

  const slotScale = emphasize ? 1.12 : nearMissActive ? 1.08 : 1;
  const borderColor = nearMissActive
    ? '#c0392b'
    : emphasize
      ? '#f5c542'
      : '#d4a853';

  const reelFrameBorderColor = '#d4a853';
  const pulseHaloShadow = pulseActive ? '0 0 0 2px #f5c542' : 'none';

  return (
    <div
      className={`cm-reel ${reelState?.rumble ? 'cm-cabinet-rumble' : ''}`}
      style={{
        ...styles.reel,
        width: SLOT_W,
        height: SLOT_H,
        opacity: dimmed ? 0.65 : 1,
        transition: dimmed ? 'opacity 80ms steps(2, end)' : 'none',
      }}
      data-cm-reel={reelIndex}
    >
      {/* Outer frame with flare animation when the reel clicks */}
      <div
        className={reelState?.flareActive ? 'cm-reel-flare' : ''}
        style={{
          ...styles.reelFrame,
          borderColor: reelFrameBorderColor,
          boxShadow: pulseHaloShadow,
        }}
      />

      {/* Full-length ribbon. translateY scrolls to center currentIndex. */}
      <div
        data-cm-ribbon
        style={{
          position: 'absolute',
          top: '50%',
          left: 0,
          width: SLOT_W,
          height: len * SLOT_H,
          transform: `translateY(${ribbonY - SLOT_H / 2}px)`,
          transition: ribbonTransition,
        }}
      >
        {allEntries.map(({ entry, idx }) => {
          const isCenter = idx === clampedIndex;
          const slotStyle = {
            position: 'absolute',
            left: 0,
            top: idx * SLOT_H,
            width: SLOT_W,
            height: SLOT_H,
            background: '#f5f0e4',
            borderWidth: 3,
            borderStyle: 'solid',
            borderColor: isCenter ? borderColor : '#d4a853',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transform: isCenter ? `scale(${slotScale})` : 'none',
            zIndex: isCenter ? 2 : 1,
            imageRendering: 'pixelated',
          };
          return (
            <div key={`${reelIndex}-${idx}`} style={slotStyle}>
              {renderSlotContent(entry, players, candidateNames)}
              {isCenter && nearMissActive && (
                <div style={styles.nearMissLabel}>THE NEW PM?</div>
              )}
              {isCenter && crowned && (
                <Crown anchorMode="reel" />
              )}
            </div>
          );
        })}
      </div>

      {/* Motion-blur streak overlay during full-speed spin */}
      {showStreak && <div className="cm-streak" style={styles.streak} />}

      {/* Reel edge shadows — sprites fade into darkness at top/bottom */}
      <div style={styles.edgeShadowTop} />
      <div style={styles.edgeShadowBot} />
    </div>
  );
}

const styles = {
  reel: {
    position: 'relative',
    overflow: 'hidden',
    background: '#1e293b',
    marginRight: 10,
    display: 'inline-block',
    imageRendering: 'pixelated',
  },
  reelFrame: {
    position: 'absolute',
    inset: 0,
    borderWidth: 4,
    borderStyle: 'solid',
    pointerEvents: 'none',
    zIndex: 5,
  },
  slotName: {
    fontSize: '0.5rem',
    fontFamily: pixel,
    color: '#2a2a3a',
    letterSpacing: 0,
    maxWidth: SLOT_W - 12,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    textAlign: 'center',
    marginTop: 4,
  },
  streak: {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    zIndex: 4,
  },
  edgeShadowTop: {
    position: 'absolute',
    top: 0, left: 0, right: 0, height: 15,
    background: 'linear-gradient(to bottom, rgba(30,41,59,0.9), rgba(30,41,59,0))',
    pointerEvents: 'none',
    zIndex: 3,
  },
  edgeShadowBot: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0, height: 15,
    background: 'linear-gradient(to top, rgba(30,41,59,0.9), rgba(30,41,59,0))',
    pointerEvents: 'none',
    zIndex: 3,
  },
  nearMissLabel: {
    position: 'absolute',
    bottom: 6,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: '0.5rem',
    fontFamily: pixel,
    color: '#d4a853',
    letterSpacing: 2,
    textShadow: '2px 2px 0 #0a0b11',
    zIndex: 10,
  },
};
