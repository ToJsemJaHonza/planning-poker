/**
 * PM walk computation for the Crowning Machine — Acts 1 and 3.
 *
 * Extracted from ceremonyPhases.js. Contains:
 *   - buildLivePlayers: defensive player map construction
 *   - resolveTargetPosition: grid position lookup with fallback
 *   - computeCrownRemoval: Act 1 phase state
 *   - computeCrownDelivery: Act 3 phase state
 *
 * Zero React imports. Pure functions only.
 */

import { CEREMONY_WALK_FRAME_MS } from '../engine/animation';
import { computePmWalkPosition, computePlayerGridPosition } from '../engine/gridPosition';
import { FAREWELL_PHRASES, CROWNING_BUBBLES } from '../events/slotMachine';

// ---------------------------------------------------------------------------
// Shared position resolution for crown ceremonies
// ---------------------------------------------------------------------------

/**
 * Build a live player map that defensively injects disconnected players
 * whose synthetic figures are still rendered by PlayerList from ceremony data.
 * Returns the sorted non-PM player list and player count.
 *
 * @param {object} ceremony  frozen payload
 * @param {object} context   { players, ... }
 * @param {{ injectWinner?: boolean }} opts  injectWinner defaults to false
 */
export function buildLivePlayers(ceremony, context, { injectWinner = false } = {}) {
  const livePlayers = { ...(context.players || {}) };
  // Inject outgoing leader if disconnected
  if (ceremony.outgoingLeaderId && !livePlayers[ceremony.outgoingLeaderId] && ceremony.outgoingLeaderLastData) {
    livePlayers[ceremony.outgoingLeaderId] = {
      ...ceremony.outgoingLeaderLastData,
      role: ceremony.outgoingLeaderLastData.role || 'player',
    };
  }
  // Inject winner if disconnected (only for crownDelivery)
  if (injectWinner && ceremony.winnerId && !livePlayers[ceremony.winnerId] && ceremony.candidateNames?.[ceremony.winnerId]) {
    livePlayers[ceremony.winnerId] = {
      name: ceremony.candidateNames[ceremony.winnerId],
      role: 'player',
      joinedAt: 0,
    };
  }
  const liveSorted = Object.entries(livePlayers)
    .filter(([, d]) => d.role !== 'pm')
    .sort((a, b) => (a[1].joinedAt || 0) - (b[1].joinedAt || 0));
  return { liveSorted, playerCount: liveSorted.length };
}

/**
 * Resolve a player's grid position from the live player list. Returns the
 * grid position if found, or a viewport-center fallback. `gridTop` is the
 * measured top of the player-grid container (snapshot from
 * `useSlotMachine`'s context); when undefined, `computePlayerGridPosition`
 * falls back to its built-in default.
 */
export function resolveTargetPosition(liveSorted, playerCount, playerId, vw, vh, gridTop) {
  const idx = liveSorted.findIndex(([id]) => id === playerId);
  return idx >= 0
    ? computePlayerGridPosition(idx, playerCount, vw, gridTop)
    : { x: vw * 0.5, y: vh * 0.4 };
}

// ---------------------------------------------------------------------------
// Crown Removal computation (Act 1) — tech design v4 ss7.1
// ---------------------------------------------------------------------------

export function computeCrownRemoval(phaseElapsed, ceremony, context) {
  const hadCrown = ceremony.outgoingLeaderHadCrown;
  const vw = context.viewportWidth || 1440;
  const vh = context.viewportHeight || 900;
  const startPos = context.ceremonyStartPos || { x: vw / 2, y: vh - 140 };
  const { liveSorted, playerCount } = buildLivePlayers(ceremony, context);
  const targetPos = resolveTargetPosition(liveSorted, playerCount, ceremony.outgoingLeaderId, vw, vh, context.gridTop);

  // Reduced-motion path: instant crown transfer, no walk animation.
  const outId = ceremony.outgoingLeaderId || null;

  if (context.reducedMotion) {
    const before200 = phaseElapsed < 200;
    return {
      crownRemovalState: before200 ? 'crownLift' : 'pmWalkBack',
      pmCeremonyPosition: targetPos,
      pmCeremonyPose: 'cast',
      pmCeremonyFacing: targetPos.x < startPos.x ? 'left' : 'right',
      pmCeremonyBubble: null,
      crownCeremonyState: hadCrown
        ? (before200
          ? { location: 'player-head', playerId: outId, progress: 1, glowing: false }
          : { location: 'pm-hand', playerId: null, progress: 1, glowing: true })
        : null,
      leaderWalkOffTriggered: phaseElapsed >= 200,
    };
  }

  let pmCeremonyPosition = startPos;
  let pmCeremonyPose = 'walk1';
  let pmCeremonyBubble = null;
  let pmCeremonyFacing = targetPos.x < startPos.x ? 'left' : 'right';
  let crownCeremonyState = hadCrown
    ? { location: 'player-head', playerId: outId, progress: 1, glowing: false }
    : null;
  let leaderWalkOffTriggered = false;
  let crownRemovalState = 'pmWalkToLeader';

  if (phaseElapsed < 2000) {
    // Walking up to leader
    crownRemovalState = 'pmWalkToLeader';
    const progress = phaseElapsed / 2000;
    pmCeremonyPosition = computePmWalkPosition(progress, startPos.x, startPos.y, targetPos.x, targetPos.y);
    pmCeremonyPose = Math.floor(phaseElapsed / CEREMONY_WALK_FRAME_MS) % 2 === 0 ? 'walk1' : 'walk2';
    const bubbleText = FAREWELL_PHRASES[ceremony.farewellPhraseIndex % FAREWELL_PHRASES.length];
    pmCeremonyBubble = { text: bubbleText, opacity: 1 };
    pmCeremonyFacing = targetPos.x < startPos.x ? 'left' : 'right';
  } else if (phaseElapsed < 2500) {
    // Receive-gravity pause at leader
    crownRemovalState = 'gravityPause';
    pmCeremonyPosition = targetPos;
    pmCeremonyPose = 'walk1';
    const bubbleText = FAREWELL_PHRASES[ceremony.farewellPhraseIndex % FAREWELL_PHRASES.length];
    pmCeremonyBubble = { text: bubbleText, opacity: 1 };
  } else if (phaseElapsed < 3000) {
    // CAST pose, crown lifts
    crownRemovalState = 'crownLift';
    pmCeremonyPosition = targetPos;
    pmCeremonyPose = 'cast';
    const bubbleText = FAREWELL_PHRASES[ceremony.farewellPhraseIndex % FAREWELL_PHRASES.length];
    pmCeremonyBubble = { text: bubbleText, opacity: Math.max(0, 1 - (phaseElapsed - 2500) / 1000) };
    if (hadCrown) {
      const liftProgress = Math.min(1, (phaseElapsed - 2500) / 500);
      crownCeremonyState = liftProgress >= 1
        ? { location: 'pm-hand', playerId: null, progress: 1, glowing: true }
        : { location: 'lifting', playerId: outId, progress: liftProgress, glowing: true };
    }
    leaderWalkOffTriggered = true;
  } else if (phaseElapsed < 4600) {
    // Walking back down (concurrent with leader walk-off)
    crownRemovalState = 'pmWalkBack';
    const returnProgress = Math.min(1, (phaseElapsed - 3000) / 1600);
    pmCeremonyPosition = computePmWalkPosition(returnProgress, targetPos.x, targetPos.y, startPos.x, startPos.y);
    pmCeremonyPose = Math.floor(phaseElapsed / CEREMONY_WALK_FRAME_MS) % 2 === 0 ? 'walk1' : 'walk2';
    pmCeremonyBubble = null;
    crownCeremonyState = hadCrown ? { location: 'pm-hand', playerId: null, progress: 1, glowing: true } : null;
    leaderWalkOffTriggered = true;
    pmCeremonyFacing = startPos.x < targetPos.x ? 'left' : 'right';
  } else {
    // Buffer: PM at start position, crown in hand (fills to 5000)
    crownRemovalState = 'silenceGap';
    pmCeremonyPosition = startPos;
    pmCeremonyPose = 'walk1';
    crownCeremonyState = hadCrown ? { location: 'pm-hand', playerId: null, progress: 1, glowing: true } : null;
    leaderWalkOffTriggered = true;
  }

  return {
    crownRemovalState,
    pmCeremonyPosition,
    pmCeremonyPose,
    pmCeremonyBubble,
    pmCeremonyFacing,
    crownCeremonyState,
    leaderWalkOffTriggered,
  };
}

// ---------------------------------------------------------------------------
// Crown Delivery computation (Act 3) — tech design v4 ss7.2
// ---------------------------------------------------------------------------

export function computeCrownDelivery(phaseElapsed, ceremony, context) {
  const hadCrown = ceremony.outgoingLeaderHadCrown;
  const vw = context.viewportWidth || 1440;
  const vh = context.viewportHeight || 900;
  const { liveSorted, playerCount } = buildLivePlayers(ceremony, context, { injectWinner: true });
  const winnerGridPos = resolveTargetPosition(liveSorted, playerCount, ceremony.winnerId, vw, vh, context.gridTop);
  const outgoingGridPos = resolveTargetPosition(liveSorted, playerCount, ceremony.outgoingLeaderId, vw, vh, context.gridTop);

  // For compressed ceremonies, PM walks directly from old leader position
  // to new leader position without returning to bottom first (G37).
  const defaultStart = context.ceremonyStartPos || { x: vw / 2, y: vh - 140 };
  const startPos = ceremony.wasCompressed
    ? outgoingGridPos
    : defaultStart;
  const targetPos = winnerGridPos;

  const winId = ceremony.winnerId || null;
  const settled = { location: 'player-head', playerId: winId, progress: 1, glowing: false };

  // Reduced-motion path: instant crown placement, no walk animation.
  if (context.reducedMotion) {
    const before200 = phaseElapsed < 200;
    let rmCrown;
    if (hadCrown) {
      rmCrown = before200
        ? { location: 'arcing-to-player', playerId: winId, progress: 0, glowing: true }
        : settled;
    } else {
      rmCrown = before200
        ? { location: 'materializing', playerId: null, progress: 0, glowing: true }
        : settled;
    }
    return {
      crownDeliveryState: before200 ? 'crownPlace' : 'complete',
      pmCeremonyPosition: targetPos,
      pmCeremonyPose: 'cast',
      pmCeremonyFacing: targetPos.x < startPos.x ? 'left' : 'right',
      pmCeremonyBubble: null,
      crownCeremonyState: rmCrown,
    };
  }

  let pmCeremonyPosition = startPos;
  let pmCeremonyPose = 'walk1';
  let pmCeremonyBubble = null;
  let pmCeremonyFacing = targetPos.x < startPos.x ? 'left' : 'right';
  let crownCeremonyState = hadCrown
    ? { location: 'pm-hand', playerId: null, progress: 1, glowing: true }
    : null;
  let crownDeliveryState = 'pmWalkToWinner';

  if (phaseElapsed < 2000) {
    // Walking up to winner
    crownDeliveryState = 'pmWalkToWinner';
    const progress = phaseElapsed / 2000;
    pmCeremonyPosition = computePmWalkPosition(progress, startPos.x, startPos.y, targetPos.x, targetPos.y);
    pmCeremonyPose = Math.floor(phaseElapsed / CEREMONY_WALK_FRAME_MS) % 2 === 0 ? 'walk1' : 'walk2';
    pmCeremonyFacing = targetPos.x < startPos.x ? 'left' : 'right';
  } else if (phaseElapsed < 2500) {
    // Deliver-gravity pause
    crownDeliveryState = 'gravityPause';
    pmCeremonyPosition = targetPos;
    pmCeremonyPose = 'walk1';
    const bubbleText = CROWNING_BUBBLES[ceremony.crowningBubbleIndex % CROWNING_BUBBLES.length];
    pmCeremonyBubble = { text: bubbleText, opacity: 1 };
  } else if (phaseElapsed < 3000) {
    // CAST pose, crown places
    crownDeliveryState = 'crownPlace';
    pmCeremonyPosition = targetPos;
    pmCeremonyPose = 'cast';
    const bubbleText = CROWNING_BUBBLES[ceremony.crowningBubbleIndex % CROWNING_BUBBLES.length];
    pmCeremonyBubble = { text: bubbleText, opacity: 1 };
    if (hadCrown) {
      const placeProgress = Math.min(1, (phaseElapsed - 2500) / 500);
      crownCeremonyState = placeProgress >= 1
        ? settled
        : { location: 'arcing-to-player', playerId: winId, progress: placeProgress, glowing: true };
    } else {
      // PM-creator case: materialize crown during delivery
      const matProgress = Math.min(1, (phaseElapsed - 2500) / 500);
      crownCeremonyState = matProgress >= 1
        ? settled
        : { location: 'materializing', playerId: null, progress: matProgress, glowing: true };
    }
  } else if (phaseElapsed < 4600) {
    // Walking back down
    crownDeliveryState = 'pmWalkBack';
    const returnProgress = Math.min(1, (phaseElapsed - 3000) / 1600);
    pmCeremonyPosition = computePmWalkPosition(returnProgress, targetPos.x, targetPos.y, defaultStart.x, defaultStart.y);
    pmCeremonyPose = Math.floor(phaseElapsed / CEREMONY_WALK_FRAME_MS) % 2 === 0 ? 'walk1' : 'walk2';
    const bubbleText = CROWNING_BUBBLES[ceremony.crowningBubbleIndex % CROWNING_BUBBLES.length];
    pmCeremonyBubble = phaseElapsed < 4500
      ? { text: bubbleText, opacity: Math.max(0, 1 - (phaseElapsed - 3000) / 1500) }
      : null;
    crownCeremonyState = settled;
    pmCeremonyFacing = defaultStart.x < targetPos.x ? 'left' : 'right';
  } else {
    // Buffer: PM at bottom, ceremony winding down
    crownDeliveryState = 'complete';
    pmCeremonyPosition = defaultStart;
    pmCeremonyPose = 'walk1';
    pmCeremonyBubble = null;
    crownCeremonyState = settled;
  }

  return {
    crownDeliveryState,
    pmCeremonyPosition,
    pmCeremonyPose,
    pmCeremonyBubble,
    pmCeremonyFacing,
    crownCeremonyState,
  };
}
