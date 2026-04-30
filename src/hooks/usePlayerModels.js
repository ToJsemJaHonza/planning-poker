import { useMemo } from 'react';
import { useEntranceEvents } from '../events/useEntranceEvents';
import { useAmbientEvents } from './useAmbientEvents';
import { usePlayerDirector } from './usePlayerDirector';
import { buildVisibleRoster } from '../engine/visibleRoster';

/**
 * Build the canonical per-player view models the grid renders from.
 *
 * As of the unified-character-stage refactor, every figure on screen
 * (PM, grid players, entering cinematics, outgoing leader) lives on the
 * shared `CharacterStage` — `PlayerList` / `PlayerCard` only paint the
 * card chrome (voting cards, name tag, stress meter, dev-quote bubble).
 * The figure slot itself is an invisible spacer; the matching character
 * on the stage is positioned at the same grid center via
 * `computePlayerGridPosition`.
 *
 * This hook therefore no longer juggles `enteringPlayers` / `leavingPlayers`
 * state or JS walk overrides — all motion flows through `usePlayerDirector`,
 * which this hook calls internally once the stage is available.
 *
 * Returned shape:
 *   {
 *     activePlayers: PlayerModel[],     // visible grid entries (ordered by joinedAt)
 *     leavingPlayers: PlayerModel[],    // always empty now — kept for API shape
 *     outgoingLeader: PlayerModel | null,
 *     activeEntrance,
 *     hiddenPlayers,
 *     handlePlayerExit,
 *     activeQuote,
 *     fukEyesSet,
 *   }
 */
export function usePlayerModels({
  players,
  currentPlayer,
  phase,
  splitMode,
  syncedEvent,
  fireSyncedEvent,
  isLeader,
  createdAt = 0,
  pmRoulette = null,
  phaseState = null,
  shameTimer = null,
  shameStage = 0,
  allVoted = false,
  stage = null,
  roomCode = null,
  gridTop,
}) {
  // The visible roster used here MUST match the roster used by
  // `usePlayerDirector` on the stage — that's what keeps each name tag
  // aligned with the figure it names. The shared helper handles the two
  // tricky cases (still-isLeader disconnected leader inside the grace
  // window; mid-ceremony outgoing leader after the promotion flip) so
  // both surfaces produce identical ordered entries.
  const playerEntries = useMemo(
    () => buildVisibleRoster(players, pmRoulette),
    [players, pmRoulette],
  );

  // ---- Entrance + ambient hooks -----------------------------------------
  const entranceEvents = useEntranceEvents({
    playerEntries, isLeader, syncedEvent, fireSyncedEvent,
  });
  const { activeEntrance, hiddenPlayers, markArrived, recentArrivals } = entranceEvents;
  const { fukEyesSet, activeQuote } = useAmbientEvents({
    playerEntries, phase, isLeader, syncedEvent, fireSyncedEvent, createdAt,
  });

  // ---- Stage director: every player figure lives here now -----------------
  usePlayerDirector({
    stage,
    players,
    pmRoulette,
    shameTimer,
    shameStage,
    allVoted,
    phaseState,
    fukEyesSet,
    hiddenPlayers,
    roomCode,
    gridTop,
  });

  // ---- Per-player model factory -----------------------------------------
  const buildModel = (id, data, opts = {}) => {
    const displayName = data?.name || id;
    const isMe = id === currentPlayer;

    const isSyntheticLeader = !!opts.isSyntheticLeader;
    const isPlaceholder = !!opts.isPlaceholder;

    // Stress meter (on card, not figure): stage applies only to the holdout.
    const isHoldout = !!shameTimer && shameTimer.holdoutId === id;
    const stressStage = isHoldout ? shameStage : 0;
    const shameStartedAt = stressStage > 0 && shameTimer ? shameTimer.startedAt : 0;

    // Dev-quote speech bubble — renders above the card.
    const isSpeaking = !isSyntheticLeader && !!activeQuote && activeQuote.name === displayName;

    const justArrived = recentArrivals.has(id);

    // Figure-side state (fukEyes) — the character stage is the authority,
    // but we still surface the derived values on the model for legacy
    // consumers and backwards-compatible tests. Crown is NOT on the model;
    // it renders from CrownStage, which consumes crownOwnership directly.
    const isNonMatchRelief = !isSyntheticLeader
      && phaseState?.nonMatchRelief
      && phaseState.nonMatchReliefPlayerId === id;
    const fukEyes = !isSyntheticLeader
      && !!(fukEyesSet?.has(displayName) || isNonMatchRelief);

    // Tremble / nod classes are applied to both the card wrapper (so voting
    // cards + name tag jitter with the figure) AND the character's inner
    // wrapper (the figure itself, drawn on the stage). Same CSS keyframes
    // play on both so they stay in sync.
    const trembleClass = stressStage >= 1
      ? `shame-tremble-${Math.min(stressStage, 5)}`
      : '';
    const nodClass = allVoted && !isSyntheticLeader
      ? 'player-nod'
      : '';
    const combinedClass = [opts.className || '', trembleClass, nodClass]
      .filter(Boolean)
      .join(' ');

    return {
      id,
      data,
      displayName,
      isMe,
      isSyntheticLeader,
      isPlaceholder,
      walking: false,          // no in-card walk animation; stage handles motion
      entering: null,
      leaving: null,
      fukEyes,
      justArrived,
      isHoldout,
      stressStage,
      shameStartedAt,
      isSpeaking,
      speakingText: isSpeaking ? activeQuote.text : '',
      doNod: !!allVoted && !isSyntheticLeader,
      className: combinedClass,
      style: opts.style || {},
      keySuffix: opts.keySuffix || '',
      testIdOverride: opts.testIdOverride,
      playerIndex: opts.playerIndex ?? 0,
      phase,
      splitMode,
    };
  };

  // The outgoing leader is now a regular entry in `playerEntries` (via
  // `buildVisibleRoster`), so the separate synthetic-card code path is
  // gone. Kept as `null` in the return shape so older call sites that
  // destructure `{ outgoingLeader }` don't break.
  const outgoingLeader = null;

  // ---- Active player models --------------------------------------------
  const activePlayers = playerEntries.map(([id, data], index) => {
    if (hiddenPlayers.has(id)) {
      const displayName = data?.name || id;
      return buildModel(id, data, {
        keySuffix: '__placeholder',
        isPlaceholder: true,
        testIdOverride: `player-${displayName}-placeholder`,
        playerIndex: index,
      });
    }
    return buildModel(id, data, {
      playerIndex: index,
    });
  });

  const handlePlayerExit = () => {
    const hiddenId = activeEntrance?.event.getHiddenPlayer?.(activeEntrance.payload);
    if (hiddenId) markArrived(hiddenId);
  };

  return {
    activePlayers,
    leavingPlayers: [],  // kept for render-site API compatibility
    outgoingLeader,
    activeEntrance,
    hiddenPlayers,
    handlePlayerExit,
    markArrived,
    activeQuote,
    fukEyesSet,
  };
}

// Exposed for tests.
export const __testing__ = {};
