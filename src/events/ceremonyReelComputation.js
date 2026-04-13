/**
 * Reel state computation for the PM Crowning Machine.
 *
 * Extracted from ceremonyPhases.js to keep reel-specific math isolated.
 * Zero React imports. Pure functions only.
 */

import {
  REEL0_STOP_AT,
  REEL1_STOP_AT,
  REEL2_SLOWDOWN_START,
  REEL2_SLOWDOWN_INTERVALS,
} from '../events/slotMachine';

// Cumulative offsets for the 6 slowdown click moments on reel 2.
export const REEL2_CLICK_MOMENTS = (() => {
  const out = [];
  let t = REEL2_SLOWDOWN_START;
  for (let i = 0; i < REEL2_SLOWDOWN_INTERVALS.length; i++) {
    t += REEL2_SLOWDOWN_INTERVALS[i];
    out.push(t);
  }
  return out;
})();

// ---------------------------------------------------------------------------
// Reel state computation
// ---------------------------------------------------------------------------

/** Default reel state factory — overrides are spread on top. */
export const reel = (o) => ({
  stopped: false, currentIndex: 0, flareActive: false,
  rumble: false, transitionMode: 'none', pulseActive: false, dimmed: false,
  ...o,
});

/** Compute the spin-phase index for a reel at a given elapsed time. */
export function spinIndex(elapsed, spinStart, reelOffset, reelLen) {
  return (Math.floor((elapsed - spinStart) / 40) + reelOffset) % reelLen;
}

/** Reel stopped at its landing index with optional flare/click. */
export function stoppedReel(landingIdx, o) {
  return reel({ stopped: true, currentIndex: landingIdx != null ? landingIdx : 0, ...o });
}

/**
 * Compute per-reel state. v4 changes:
 *   - spinPhaseStart moved to 2800ms (was 1550ms)
 *   - All reel stop times shifted by +1250ms
 *   - Phase 'crownRemoval' and 'cabinetDrop' added as idle/entry states
 */
export function computeReelStates(elapsed, phase, phaseElapsed, context) {
  const { reelOrders, ceremony } = context;
  const winnerIdx = context.winnerIndexInReel2;
  const nearMissIdx = context.nearMissIndexInReel2;
  const reel0LandingIdx = context.reel0LandingIdx;
  const reel1LandingIdx = context.reel1LandingIdx;
  const nonMatchReelIndex = context.nonMatchReelIndex;
  const winnerReelPair = ceremony.winnerReelPair;
  const idleStates = [reel(), reel(), reel()];

  // Compressed: all three reels frozen on the winner slot from the start.
  if (ceremony.wasCompressed) {
    return [reel({ stopped: true }), reel({ stopped: true }), reel({ stopped: true })];
  }

  // Before cabinet / after cabinet: reels idle.
  if (phase === 'idle' || phase === 'crownRemoval' || phase === 'cabinetDrop' || phase === 'done' || phase === 'crownDelivery') {
    return idleStates;
  }

  // v4+: spinning phase start at 5400ms (2x longer ceremony)
  const SPS = 5400;

  // Spinning reel 2 helper (reused in spinning, decelerating, matchedHold, reel3Decel)
  const spinningReel2 = () => reel({ currentIndex: spinIndex(elapsed, SPS, 6, reelOrders[2].length) });

  // Full-speed spin
  if (phase === 'spinning') {
    return [0, 1, 2].map(i => reel({ currentIndex: spinIndex(elapsed, SPS, i * 3, reelOrders[i].length) }));
  }

  // Decelerating phase covers reel 0 stop, reel 1 stop.
  if (phase === 'decelerating') {
    const r0 = elapsed < REEL0_STOP_AT
      ? reel({ currentIndex: spinIndex(elapsed, SPS, 0, reelOrders[0].length) })
      : stoppedReel(reel0LandingIdx, {
          flareActive: elapsed < REEL0_STOP_AT + 80,
          transitionMode: elapsed === REEL0_STOP_AT ? 'click' : 'none',
        });
    const r1 = elapsed < REEL1_STOP_AT
      ? reel({ currentIndex: spinIndex(elapsed, SPS, 3, reelOrders[1].length) })
      : stoppedReel(reel1LandingIdx, {
          flareActive: elapsed < REEL1_STOP_AT + 80,
          transitionMode: elapsed === REEL1_STOP_AT ? 'click' : 'none',
        });
    return [r0, r1, spinningReel2()];
  }

  // matchedHold: winner-pair reels pulse, reel 2 still spinning.
  if (phase === 'matchedHold') {
    const matchedHoldStart = context.matchedHoldAbsoluteStart || 9900;
    const pulsePhase = (elapsed - matchedHoldStart) % 300;
    const pulseOn = pulsePhase >= 60 && pulsePhase < 240;
    return [
      stoppedReel(reel0LandingIdx, { pulseActive: winnerReelPair?.includes(0) ? pulseOn : false }),
      stoppedReel(reel1LandingIdx, { pulseActive: winnerReelPair?.includes(1) ? pulseOn : false }),
      spinningReel2(),
    ];
  }

  // reel3Decel: reels 0/1 locked, reel 2 walks through slowdown clicks
  if (phase === 'reel3Decel') {
    const r0 = stoppedReel(reel0LandingIdx);
    const r1 = stoppedReel(reel1LandingIdx);

    const lastClickMoment = REEL2_CLICK_MOMENTS[REEL2_CLICK_MOMENTS.length - 1];
    const nearMissHoldEnd = lastClickMoment + 200;
    const nudgeEnd = nearMissHoldEnd + 440;

    let r2;
    if (elapsed < REEL2_SLOWDOWN_START) {
      r2 = spinningReel2();
    } else if (elapsed < lastClickMoment) {
      let clickIdx = -1;
      for (let i = 0; i < REEL2_CLICK_MOMENTS.length; i++) {
        if (elapsed >= REEL2_CLICK_MOMENTS[i]) clickIdx = i;
      }
      const nearMissAbsolute = nearMissIdx != null ? nearMissIdx : (winnerIdx != null ? winnerIdx : 0);
      const idx = clickIdx < 0
        ? spinIndex(REEL2_SLOWDOWN_START, SPS, 6, reelOrders[2].length)
        : ((nearMissAbsolute - (REEL2_CLICK_MOMENTS.length - 1 - clickIdx) + reelOrders[2].length) % reelOrders[2].length);
      r2 = reel({
        stopped: clickIdx === REEL2_CLICK_MOMENTS.length - 1,
        currentIndex: idx,
        flareActive: clickIdx >= 0 && elapsed < REEL2_CLICK_MOMENTS[clickIdx] + 40,
        transitionMode: 'click',
      });
    } else if (elapsed < nearMissHoldEnd) {
      r2 = reel({
        stopped: true,
        currentIndex: nearMissIdx != null ? nearMissIdx : (winnerIdx != null ? winnerIdx : 0),
        rumble: elapsed >= lastClickMoment + 60 && elapsed < lastClickMoment + 200,
        nearMissHold: true,
      });
    } else if (elapsed < nudgeEnd) {
      const p = Math.min(1, (elapsed - nearMissHoldEnd) / 440);
      r2 = reel({
        stopped: p >= 1,
        currentIndex: winnerIdx != null ? winnerIdx : 0,
        nudgeProgress: p,
        transitionMode: 'nudge',
      });
    } else {
      r2 = stoppedReel(winnerIdx);
    }
    return [r0, r1, r2];
  }

  // After reel3Decel (winnerFreeze, winnerEmphasis, cabinetOut):
  const dimNonMatch = phase === 'winnerEmphasis' || phase === 'cabinetOut';
  return [
    stoppedReel(reel0LandingIdx, { dimmed: dimNonMatch && nonMatchReelIndex === 0 }),
    stoppedReel(reel1LandingIdx, { dimmed: dimNonMatch && nonMatchReelIndex === 1 }),
    stoppedReel(winnerIdx),
  ];
}
