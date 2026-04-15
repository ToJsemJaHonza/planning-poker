import { useEffect, useMemo, useRef, useState } from 'react';
import { hashDir } from '../components/playerList.utils';
import { useEntranceEvents } from '../events/useEntranceEvents';
import { useAmbientEvents } from './useAmbientEvents';
import { useFrameTicker } from '../engine/useFrameTicker';
import { useMotionMode } from '../engine/useMotionMode';
import {
  shouldDriveWalkInJs,
  walkRestingState,
  walkTransformAt,
} from '../engine/walkAnimation';

/**
 * Crown-roulette ceremony elapsed window (ms).
 * - 0..3000 ms: outgoing leader still wears the crown
 * - 3000..5000 ms: outgoing leader walks off
 * - >=5000 ms: synthetic leader figure removed from the grid
 *
 * The PM ceremony is delivered as a coordinated phase machine elsewhere;
 * here we only need a frame-driven elapsed count so we can decide when to
 * unrender the synthetic figure.
 */
const CROWN_REMOVAL_TOTAL_MS = 5000;
const CROWN_REMOVAL_WALKOFF_MS = 3000;
// We keep ticking 500ms past the totals so the disappearance is frame-precise
// even if rAF fires slightly late.
const CROWN_TICKER_GUARD_MS = 5500;

/**
 * Build the canonical per-player view models the grid renders from.
 *
 * Replaces the inline state machines that used to live inside
 * `PlayerList.jsx`. Every join/leave/ceremony/shame/celebration flag a
 * given player needs to react to is normalised into a single object so
 * the renderer is a pure `models.map(...)`.
 *
 * Returned shape:
 *   {
 *     activePlayers: PlayerModel[],     // visible grid entries (ordered by joinedAt)
 *     leavingPlayers: PlayerModel[],    // figures still in their walk-out animation
 *     outgoingLeader: PlayerModel | null, // synthetic figure during crown ceremony Act 1
 *     activeEntrance,                   // passthrough from useEntranceEvents
 *     hiddenPlayers,                    // passthrough for EntranceStage placeholder logic
 *     handlePlayerExit,                 // bound to the active entrance event
 *     activeQuote,                      // passthrough from useAmbientEvents (rendered per-card)
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
  crownOwnership = null,
  shameTimer = null,
  shameStage = 0,
  allVoted = false,
}) {
  // Memoised so the join/leave effect (which depends on the id list) doesn't
  // re-fire on every parent render that produces an equivalent player map.
  const playerEntries = useMemo(
    () => Object.entries(players)
      .filter(([, data]) => data.role !== 'pm')
      .sort((a, b) => a[1].joinedAt - b[1].joinedAt),
    [players],
  );

  // ---- Crown-removal elapsed (drives synthetic-leader visibility) ------
  const ceremonyStartedAt = pmRoulette?.startedAt ?? null;
  const ceremonyId = pmRoulette?.ceremonyId ?? null;
  const [crownRemovalElapsed, setCrownRemovalElapsed] = useState(0);

  useEffect(() => {
    if (!ceremonyStartedAt) {
      setCrownRemovalElapsed(0);
    } else {
      setCrownRemovalElapsed(Date.now() - ceremonyStartedAt);
    }
  }, [ceremonyStartedAt, ceremonyId]);

  useFrameTicker(
    50,
    () => {
      if (ceremonyStartedAt) setCrownRemovalElapsed(Date.now() - ceremonyStartedAt);
    },
    !!ceremonyStartedAt && crownRemovalElapsed < CROWN_TICKER_GUARD_MS,
  );

  const isInCrownRemoval = !!pmRoulette && crownRemovalElapsed < CROWN_REMOVAL_TOTAL_MS;
  const leaderWalkOff = crownRemovalElapsed >= CROWN_REMOVAL_WALKOFF_MS;
  const outgoingId = pmRoulette?.outgoingLeaderId || null;
  const outgoingData = pmRoulette?.outgoingLeaderLastData || null;

  // ---- Entrance + ambient hooks (unchanged) ----------------------------
  const { activeEntrance, hiddenPlayers, markArrived, recentArrivals } = useEntranceEvents({
    playerEntries, isLeader, syncedEvent, fireSyncedEvent,
  });
  const { fukEyesSet, activeQuote } = useAmbientEvents({
    playerEntries, phase, isLeader, syncedEvent, fireSyncedEvent, createdAt,
  });

  // ---- Join / leave bookkeeping ---------------------------------------
  // The grid keeps figures around briefly after they leave so the walk-out
  // animation can play. Newly-joined ids get a walk-in direction & duration
  // hashed off their name, and the entry is dropped once the animation
  // window expires.
  const knownRef = useRef(new Set());
  const lastPlayerDataRef = useRef({});
  const [enteringPlayers, setEnteringPlayers] = useState({});
  const [leavingPlayers, setLeavingPlayers] = useState({});

  const idListKey = playerEntries.map(([id]) => id).join(',');

  useEffect(() => {
    const currentIds = playerEntries.map(([id]) => id);
    const currentSet = new Set(currentIds);
    const newPlayers = {};
    const gonePlayers = {};

    playerEntries.forEach(([id, data]) => {
      lastPlayerDataRef.current[id] = data;
    });

    let maxDuration = 0;
    const startedAt = Date.now();
    for (const id of currentIds) {
      if (!knownRef.current.has(id)) {
        if (hiddenPlayers.has(id)) continue;
        const displayName = lastPlayerDataRef.current[id]?.name || id;
        const info = hashDir(displayName);
        newPlayers[id] = { ...info, startedAt };
        if (info.duration > maxDuration) maxDuration = info.duration;
      }
    }

    for (const id of knownRef.current) {
      if (!currentSet.has(id)) {
        // Skip players whose exit is handled by the crown ceremony — the
        // synthetic-leader figure manages its own walk-off so we don't want
        // a duplicate leaving figure for the same id.
        if (pmRoulette?.outgoingLeaderId === id) continue;
        if (crownOwnership?.playerId === id) continue;
        const data = lastPlayerDataRef.current[id] || { name: id };
        const info = hashDir(data.name || id);
        const exitDir = info.dir === 'left' ? 'right' : 'left';
        gonePlayers[id] = {
          info: { dir: exitDir, duration: info.duration, startedAt },
          data,
        };
      }
    }

    if (Object.keys(newPlayers).length > 0) {
      setEnteringPlayers(prev => ({ ...prev, ...newPlayers }));
      setTimeout(() => {
        setEnteringPlayers(prev => {
          const next = { ...prev };
          Object.keys(newPlayers).forEach(k => delete next[k]);
          return next;
        });
      }, (maxDuration + 0.2) * 1000);
    }

    if (Object.keys(gonePlayers).length > 0) {
      setLeavingPlayers(prev => ({ ...prev, ...gonePlayers }));
      const exitMaxDuration = Math.max(...Object.values(gonePlayers).map(g => g.info.duration));
      const goneIds = Object.keys(gonePlayers);
      setTimeout(() => {
        setLeavingPlayers(prev => {
          const next = { ...prev };
          goneIds.forEach(k => delete next[k]);
          return next;
        });
        goneIds.forEach(k => delete lastPlayerDataRef.current[k]);
      }, (exitMaxDuration + 0.3) * 1000);
    }

    knownRef.current = currentSet;
    // We intentionally key on the joined id list — re-running on every data
    // re-shape would re-trigger the walk-in animations.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idListKey]);

  // If a ceremony starts targeting a player that's already in leavingPlayers,
  // remove them immediately so we don't render both the leaving animation
  // and the synthetic leader at the same time.
  useEffect(() => {
    if (!outgoingId) return;
    setLeavingPlayers(prev => {
      if (!prev[outgoingId]) return prev;
      const next = { ...prev };
      delete next[outgoingId];
      return next;
    });
  }, [outgoingId]);

  // ---- JS-driven walk overrides (motionMode-aware) -------------------
  // When the browser refuses CSS animations or the user prefers reduced
  // motion, we drive walk-in/out via inline transforms instead of relying
  // on @keyframes. A 16ms ticker re-renders to recompute progress.
  const motionMode = useMotionMode();
  const walkOverrideActive = shouldDriveWalkInJs(motionMode)
    && (Object.keys(enteringPlayers).length > 0 || Object.keys(leavingPlayers).length > 0);
  const [, forceWalkTick] = useState(0);
  useFrameTicker(
    16,
    () => forceWalkTick((n) => (n + 1) | 0),
    walkOverrideActive && motionMode === 'none',
  );

  function jsWalkStyle({ kind, dir, duration, startedAt }) {
    if (motionMode === 'full') return null;
    if (motionMode === 'reduced') return walkRestingState({ kind });
    // 'none' — drive every frame.
    const elapsedMs = startedAt ? Date.now() - startedAt : 0;
    const { transform, opacity } = walkTransformAt({
      elapsedMs,
      durationMs: (duration || 0) * 1000,
      dir,
      kind,
    });
    return { transform, opacity };
  }

  // ---- Per-player model factory ---------------------------------------
  const buildModel = (id, data, opts = {}) => {
    const displayName = data?.name || id;
    const isMe = id === currentPlayer;

    const isSyntheticLeader = !!opts.isSyntheticLeader;
    const isPlaceholder = !!opts.isPlaceholder;

    // Ambient: fuk eyes (peeking pose) — driven by Firebase-synced ambient
    // event PLUS the slot-machine non-match relief beat.
    const isNonMatchRelief = !isSyntheticLeader
      && phaseState?.nonMatchRelief
      && phaseState.nonMatchReliefPlayerId === id;
    const fukEyes = !isSyntheticLeader && (fukEyesSet.has(displayName) || isNonMatchRelief);

    // Crown ownership: only show on a real grid entry, never on a leaving
    // ghost (would teleport). Synthetic-leader crown is handled by its own
    // override below.
    const showCrown = !opts.suppressCrown && crownOwnership
      ? crownOwnership.location === 'player-head'
        && crownOwnership.playerId === id
      : false;

    // Shame: stress stage applies only to the holdout. StressMeter self-updates
    // via its own 1s interval from `startedAt`, so the model only needs to
    // propagate when the timer started (not the running elapsed).
    const isHoldout = !!shameTimer && shameTimer.holdoutId === id;
    const stressStage = isHoldout ? shameStage : 0;
    const shameStartedAt = stressStage > 0 && shameTimer ? shameTimer.startedAt : 0;

    // Speech bubble (dev quotes) — name-keyed lookup against ambient events.
    const isSpeaking = !isSyntheticLeader && !!activeQuote && activeQuote.name === displayName;

    const justArrived = recentArrivals.has(id);

    return {
      id,
      data,
      displayName,
      isMe,
      isSyntheticLeader,
      isPlaceholder,
      walking: !!opts.walking,
      entering: opts.entering ?? null,
      leaving: opts.leaving ?? null,
      fukEyes,
      showCrown,
      justArrived,
      isHoldout,
      stressStage,
      shameStartedAt,
      isSpeaking,
      speakingText: isSpeaking ? activeQuote.text : '',
      doNod: !!allVoted && !opts.entering && !isSyntheticLeader,
      className: opts.className || '',
      style: opts.style || {},
      keySuffix: opts.keySuffix || '',
      testIdOverride: opts.testIdOverride,
      playerIndex: opts.playerIndex ?? 0,
      phase,
      splitMode,
    };
  };

  // ---- Synthetic outgoing leader (Act 1) ------------------------------
  const showOutgoing =
    outgoingId && outgoingData && outgoingData.role !== 'pm'
    && isInCrownRemoval
    && !playerEntries.some(([id]) => id === outgoingId);

  const outgoingDir = outgoingData
    ? (hashDir(outgoingData.name || '').dir === 'left' ? 'right' : 'left')
    : 'right';
  const outgoingJsWalk = leaderWalkOff
    ? jsWalkStyle({ kind: 'out', dir: outgoingDir, duration: 0.6, startedAt: ceremonyStartedAt })
    : null;
  const outgoingLeader = showOutgoing
    ? buildModel(outgoingId, { ...outgoingData, isLeader: !leaderWalkOff }, {
        keySuffix: '__synthetic-leader',
        isSyntheticLeader: true,
        suppressCrown: true,
        testIdOverride: `player-${outgoingData.name}-outgoing`,
        className: leaderWalkOff ? `player-walk-out-${outgoingDir}` : '',
        style: {
          ...(leaderWalkOff ? { '--enter-duration': '0.6s' } : {}),
          ...(outgoingJsWalk || {}),
        },
        walking: !!leaderWalkOff,
      })
    : null;

  // ---- Active player models (placeholders + visible grid entries) ------
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

    const enterInfo = enteringPlayers[id];
    const isHoldout = !!shameTimer && shameTimer.holdoutId === id && shameStage > 0;
    const trembleClass = isHoldout ? `shame-tremble-${Math.min(shameStage, 5)}` : '';
    const nodClass = allVoted && !enterInfo ? 'player-nod' : '';
    const className = [
      enterInfo ? `player-walk-in-${enterInfo.dir}` : '',
      trembleClass,
      nodClass,
    ].filter(Boolean).join(' ');

    const enterJsWalk = enterInfo
      ? jsWalkStyle({
          kind: 'in',
          dir: enterInfo.dir,
          duration: enterInfo.duration,
          startedAt: enterInfo.startedAt,
        })
      : null;

    return buildModel(id, data, {
      className,
      style: {
        ...(enterInfo ? { '--enter-duration': `${enterInfo.duration}s` } : {}),
        ...(nodClass ? { animationDelay: `${index * 60}ms` } : {}),
        ...(enterJsWalk || {}),
      },
      walking: !!enterInfo,
      entering: enterInfo ?? null,
      playerIndex: index,
    });
  });

  // ---- Leaving players (separate list so renderer can place them last) -
  const leavingModels = Object.entries(leavingPlayers).map(([id, { info, data }]) => {
    const leaveJsWalk = jsWalkStyle({
      kind: 'out',
      dir: info.dir,
      duration: info.duration,
      startedAt: info.startedAt,
    });
    return buildModel(id, data, {
      keySuffix: '__leaving',
      className: `player-walk-out-${info.dir}`,
      style: {
        '--enter-duration': `${info.duration}s`,
        ...(leaveJsWalk || {}),
      },
      walking: true,
      leaving: info,
      // Crown should never re-mount on a leaving ghost (CSS transition would
      // teleport it across the screen).
      suppressCrown: true,
    });
  });

  const handlePlayerExit = () => {
    const hiddenId = activeEntrance?.event.getHiddenPlayer?.(activeEntrance.payload);
    if (hiddenId) markArrived(hiddenId);
  };

  return {
    activePlayers,
    leavingPlayers: leavingModels,
    outgoingLeader,
    activeEntrance,
    hiddenPlayers,
    handlePlayerExit,
    activeQuote,
  };
}

// Exposed for tests so they can assert on phase boundaries without copying constants.
export const __testing__ = {
  CROWN_REMOVAL_TOTAL_MS,
  CROWN_REMOVAL_WALKOFF_MS,
  CROWN_TICKER_GUARD_MS,
};
