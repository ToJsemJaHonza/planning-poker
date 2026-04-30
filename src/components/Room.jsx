import { useState, useEffect, useRef, useCallback } from 'react';
import { useRoom } from '../hooks/useRoom';
import { useShameTimer } from '../hooks/useShameTimer';
import { useRoomStartCrowning } from '../hooks/useRoomStartCrowning';
import { useSlotMachine } from '../hooks/useSlotMachine';
import { useCrownOwnership } from '../hooks/useCrownOwnership';
import { useCharacterStage } from '../hooks/useCharacterStage';
import { usePmDirector } from '../hooks/usePmDirector';
import { useOktaKeys } from '../hooks/useOktaKeys';
import { useGridTop } from '../engine/useGridTop';
import {
  isValidCeremonyPayload,
  isStalePayload,
} from '../events/slotMachine';
import CardPicker, { SplitCardPicker } from './CardPicker';
import PlayerList from './PlayerList';
import ResultModal from './ResultModal';
import CharacterStage from './CharacterStage';
import CrownStage from './CrownStage';
import RevealBackground from './RevealBackground';
import ShameOverlay from './shame/ShameOverlay';
import SlotMachineStage from './SlotMachineStage';
import RoomHeader from './room/RoomHeader';
import TaskBar from './room/TaskBar';
import TaskListPanel from './room/TaskListPanel';
import TaskSwitchToast from './room/TaskSwitchToast';
import PhaseBar from './room/PhaseBar';
import StatusBar from './room/StatusBar';
import LeaderBanner from './room/LeaderBanner';
import OverlayStage from '../events/OverlayStage';
import { pixel, computeRoomPaddingBottom } from './room/styles';

export default function Room({ roomCode, playerId, playerName, role = 'player', initialTasks = [] }) {
  const {
    players, phase, task, taskList, taskSwitchNotice, setActiveTask, upsertTasks, splitMode,
    pmQuote, setPmQuote,
    triggerOkta,
    syncedEvent, fireSyncedEvent,
    pmRoulette, resolvePmRoulettePromotion, clearPmRoulette,
    roomStartCrowning, roomStartCrowned, shameTimer, setShameTimer, roomDeleted,
    isLeader, connected, leaderChangedAt, createdAt,
    castVote, castVoteFe, castVoteBe,
    toggleSplit, revealCards, newRound, updateTask,
  } = useRoom(roomCode, playerId, playerName, role, initialTasks);

  // --- Unified character stage ---
  // The PM (and, after later phases, players and entering cinematics) live
  // on a single long-running stage whose characters persist across every
  // mode. No mount/unmount at ceremony boundaries — so no handoff jump.
  const stage = useCharacterStage();
  const ceremonyActive = !!(pmRoulette || roomStartCrowning);

  // Downstream hooks need `ceremonyStartPos` from the director, and the
  // director's ceremony mirror needs their output. Refs break the cycle:
  // they're assigned later in this render and the director's
  // useLayoutEffect reads them after commit.
  const phaseStateRef = useRef(null);
  const roomStartStateRef = useRef(null);

  // Live measurement of the player-grid container's viewport y. Threaded
  // through every consumer of `computePlayerGridPosition` so the figure
  // y tracks the card flow regardless of how tall the header / TaskBar /
  // PhaseBar grew. Without this, a hardcoded GRID_TOP misaligns the
  // figure and its name tag in PM-only / leader / plain-player views and
  // again whenever the room toggles between empty task and grooming list.
  const playerGridRef = useRef(null);
  const gridTop = useGridTop(playerGridRef);

  const { ceremonyStartPos } = usePmDirector({
    stage,
    ceremonyActive,
    phaseStateRef,
    roomStartStateRef,
    isLeader,
    externalQuote: !isLeader ? pmQuote : '',
    onQuote: isLeader ? setPmQuote : null,
  });

  // --- Room-start mini-ceremony ---
  const roomStartState = useRoomStartCrowning({
    roomCode, playerId, role, connected, isLeader,
    players, roomStartCrowning, pmRoulette,
    ceremonyStartPos,
    roomStartCrowned,
    gridTop,
  });

  // --- Slot machine ceremony validation ---
  const smIsValid = isValidCeremonyPayload(pmRoulette);
  const smIsStale = !pmRoulette || isStalePayload(pmRoulette);
  const smReportedRef = useRef(new Set());

  useEffect(() => {
    if (!pmRoulette) return;
    const key = pmRoulette.ceremonyId || `stale-${pmRoulette.startedAt || 0}`;
    if (smReportedRef.current.has(key)) return;
    if (!smIsValid || smIsStale) {
      smReportedRef.current.add(key);
      clearPmRoulette?.(pmRoulette);
    }
  }, [pmRoulette, smIsValid, smIsStale, clearPmRoulette]);

  const ceremonyForHook = smIsValid && !smIsStale ? pmRoulette : null;

  const onLeaderPromote = useCallback(() => {
    if (!pmRoulette) return;
    resolvePmRoulettePromotion?.(pmRoulette);
  }, [pmRoulette, resolvePmRoulettePromotion]);

  const onCeremonyComplete = useCallback(() => {
    if (!pmRoulette) return;
    clearPmRoulette?.(pmRoulette);
  }, [pmRoulette, clearPmRoulette]);

  const slotMachinePhaseState = useSlotMachine(ceremonyForHook, {
    onLeaderPromote, onCeremonyComplete,
    ceremonyStartPos, players, gridTop,
  });

  const crownOwnership = useCrownOwnership({
    players, slotMachinePhaseState, roomStartState, pmRoulette,
  });

  // Wire late-computed state back into the director's mirror. Assigning
  // refs during render is fine — the director's useLayoutEffect reads them
  // after commit, so it always sees the latest tick's values.
  phaseStateRef.current = slotMachinePhaseState;
  roomStartStateRef.current = roomStartState;

  // --- Derived state ---
  const isPM = role === 'pm';
  const canControl = isLeader;
  const me = players[playerId];
  const myVote = me?.vote || null;
  const myVoteFe = me?.voteFe || null;
  const myVoteBe = me?.voteBe || null;
  // Disconnected players keep their DB record (so the ceremony trigger
  // still sees hasLeader=true when the leader refreshes), but the vote
  // count / grid / shame timer must treat them as absent.
  const votingPlayers = Object.values(players).filter(p => p.role !== 'pm' && !p.disconnected);
  const playerCount = votingPlayers.length;
  const votedCount = splitMode
    ? votingPlayers.filter(p => p.voteFe != null && p.voteBe != null).length
    : votingPlayers.filter(p => p.vote != null).length;
  const currentLeaderName = Object.values(players).find((p) => p.isLeader)?.name;

  const allVoted = votedCount === playerCount && playerCount > 0;

  // Celebration only fires when everyone voted with real estimates (no ? or ☕)
  const NON_ESTIMATE_VOTES = ['?', '☕'];
  const allVotedClean = allVoted && votingPlayers.every(p => {
    if (splitMode) {
      return !NON_ESTIMATE_VOTES.includes(p.voteFe) && !NON_ESTIMATE_VOTES.includes(p.voteBe);
    }
    return !NON_ESTIMATE_VOTES.includes(p.vote);
  });

  // --- Shame timer: detect holdout, write/clear Firebase ---
  const shame = useShameTimer(shameTimer, playerId);

  // Track the current holdout via ref to avoid race conditions where
  // shameTimer React state is transiently null between Firebase reads.
  // Without this, voting FE in split mode can reset the timer because
  // the re-render sees shameTimer=null and rewrites with a new startedAt.
  const shameHoldoutRef = useRef(null);

  // Stable identity string for player map — triggers when players join/leave/vote
  const playerSnapshot = JSON.stringify(
    Object.entries(players).map(([id, d]) => [id, d.vote, d.voteFe, d.voteBe]).sort()
  );

  useEffect(() => {
    // Only the leader manages the shame timer — non-leaders must never
    // write to Firebase (they'd clear the timer the leader wrote).
    if (!canControl) return;

    if (phase !== 'voting') {
      if (shameTimer) setShameTimer(null);
      shameHoldoutRef.current = null;
      return;
    }
    const notVoted = votingPlayers.filter(p =>
      splitMode ? (p.voteFe == null || p.voteBe == null) : p.vote == null
    );
    if (notVoted.length === 1 && playerCount > 1) {
      const holdout = notVoted[0];
      const holdoutEntry = Object.entries(players).find(([, d]) => d === holdout);
      if (holdoutEntry && shameHoldoutRef.current !== holdoutEntry[0]) {
        const holdoutId = holdoutEntry[0];
        // If Firebase already has a live shameTimer for THIS holdout, the
        // previous leader already started the stress clock. Restore the
        // ref from it instead of overwriting with a fresh `startedAt` —
        // that's what used to zero-out the accumulated stage whenever
        // the leader's own tab refreshed while a holdout was stressed.
        const existingMatches = shameTimer && shameTimer.holdoutId === holdoutId;
        shameHoldoutRef.current = holdoutId;
        if (!existingMatches) {
          setShameTimer({
            holdoutName: holdout.name,
            holdoutId,
            startedAt: Date.now(),
          });
        }
      }
    } else {
      // If the current holdout just disconnected (is marked
      // `disconnected: true` but still in the raw players map and hasn't
      // voted), don't tear down the shame timer. Otherwise they'd come
      // back from a refresh, re-enter `votingPlayers`, and we'd write a
      // brand-new shameTimer with a fresh startedAt — wiping the
      // accumulated stress stage the user had built up to.
      const holdoutId = shameHoldoutRef.current;
      if (holdoutId) {
        const raw = players[holdoutId];
        const stillNotVoted = raw && (
          splitMode ? (raw.voteFe == null || raw.voteBe == null) : raw.vote == null
        );
        if (raw && raw.disconnected && stillNotVoted) return;
      }
      if (shameTimer || shameHoldoutRef.current) {
        setShameTimer(null);
        shameHoldoutRef.current = null;
      }
    }
  // playerSnapshot covers join/leave/vote changes from the players object
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canControl, phase, playerSnapshot, playerCount, splitMode]);

  // --- Local UI state ---
  const [showResult, setShowResult] = useState(false);

  const handleReveal = async () => {
    await revealCards();
    if (Math.random() < 0.01) {
      fireSyncedEvent({ type: 'chicken' }, 3500);
    }
    // Delay increased to let staggered card flip animation finish before modal
    setTimeout(() => setShowResult(true), 900);
  };

  const handleNewRound = () => {
    setShowResult(false);
    newRound();
  };

  // OKTA easter egg — extracted to its own hook so Room.jsx stays
  // focused on layout. The hook itself bails out unless playerName
  // matches "honza" (case-insensitive).
  useOktaKeys({ playerName, onTrigger: triggerOkta });

  // Sticky bit: once we've ever been connected, a `connected=false` means
  // we LOST the socket mid-session — the room state we already have is
  // valid and should keep rendering with a banner over it. Without this,
  // a transient drop would dump the user back to the "Connecting…" screen
  // and visually wipe the room.
  const wasEverConnectedRef = useRef(false);
  useEffect(() => {
    if (connected) wasEverConnectedRef.current = true;
  }, [connected]);

  // --- Terminal states ---
  if (roomDeleted) {
    return (
      <div style={styles.loading}>
        <p style={{ color: '#d4a853', fontSize: '0.8rem', fontFamily: pixel }}>Room ended</p>
        <p style={{ color: '#888', fontSize: '0.55rem', fontFamily: pixel, marginTop: 12 }}>
          All players have left.
        </p>
        <button
          onClick={() => { window.location.href = window.location.pathname; }}
          style={styles.backBtn}
        >
          Back to lobby
        </button>
      </div>
    );
  }

  // Initial connect: nothing to render yet. After we've been connected at
  // least once we fall through and render the room — the banner below
  // covers the disconnected case.
  if (!connected && !wasEverConnectedRef.current) {
    return (
      <div style={styles.loading}>
        <p>Connecting to room {roomCode}...</p>
      </div>
    );
  }

  // --- Padding for entrance events ---
  const hasEntrance = syncedEvent && (syncedEvent.type === 'train' || syncedEvent.type === 'dbbPipeline');
  const paddingBottom = computeRoomPaddingBottom({ hasEntrance, isPM, canControl, splitMode });

  return (
    <div style={{ ...styles.container, paddingBottom, transition: 'padding-bottom 0.3s ease' }}>
      {!connected && (
        <div role="status" style={styles.reconnectBanner} data-reconnect-banner>
          Reconnecting to Firebase…
        </div>
      )}

      {/* Every animated character (PM now, players + entering cinematics
          in later phases) lives on one persistent stage. No mount/unmount
          at phase boundaries, so no teleport between idle and ceremony. */}
      <CharacterStage stage={stage} />

      {/* Single crown renderer. Every place that used to paint its own
          crown (PlayerFigure's head crown, PmSprite's ceremony block,
          `char.crown` mirroring in both directors) has been deleted —
          the crown's authoritative state is `crownOwnership` and this
          is the one renderer that consumes it. */}
      <CrownStage stage={stage} crownOwnership={crownOwnership} />

      <RoomHeader roomCode={roomCode} playerCount={playerCount} />
      <TaskBar task={task} canControl={canControl} phase={phase} onSave={updateTask} taskList={taskList} />
      {/* The side panel is leader-only: everyone else sees the full backlog
          inline in the TaskBar strip above. Hiding it here (rather than
          inside TaskListPanel) keeps the panel's own logic focused on the
          leader's edit/export/jump affordances. */}
      {canControl && (
        <TaskListPanel
          taskList={taskList}
          isLeader={canControl}
          onSetActive={setActiveTask}
          onEdit={upsertTasks}
          roomCode={roomCode}
        />
      )}
      <TaskSwitchToast notice={taskSwitchNotice} />
      <PhaseBar
        phase={phase} splitMode={splitMode}
        votedCount={votedCount} playerCount={playerCount}
        canControl={canControl} allVotedClean={allVotedClean}
        onToggleSplit={toggleSplit} onReveal={handleReveal} onNewRound={handleNewRound}
      />

      <div className={shame.isHoldout && shame.stage >= 4 ? 'screen-shake' : ''}>
        <PlayerList
          players={players} phase={phase} currentPlayer={playerId}
          splitMode={splitMode} syncedEvent={syncedEvent}
          fireSyncedEvent={fireSyncedEvent} isLeader={isLeader}
          createdAt={createdAt} pmRoulette={pmRoulette}
          phaseState={slotMachinePhaseState}
          shameTimer={shameTimer} shameStage={shame.stage}
          allVoted={allVotedClean} /* nod animation only for clean votes */
          stage={stage} roomCode={roomCode}
          gridRef={playerGridRef} gridTop={gridTop}
        />
      </div>

      {/* Shame timer overlay — vignette + floating text */}
      <ShameOverlay
        stage={shame.stage}
        holdoutName={shame.holdoutName}
        isHoldout={shame.isHoldout}
        elapsed={shame.elapsed}
      />

      {/* Card picker — players only */}
      {!isPM && phase === 'voting' && !splitMode && (
        <CardPicker selectedVote={myVote} onVote={castVote} disabled={false} bottomOffset={canControl ? 40 : 0} />
      )}
      {!isPM && phase === 'voting' && splitMode && (
        <SplitCardPicker
          voteFe={myVoteFe} voteBe={myVoteBe}
          onVoteFe={castVoteFe} onVoteBe={castVoteBe}
          disabled={false} bottomOffset={canControl ? 40 : 0}
        />
      )}

      {/* Leader status bar */}
      {canControl && <StatusBar phase={phase} votedCount={votedCount} playerCount={playerCount} allVotedClean={allVotedClean} />}

      <LeaderBanner leaderChangedAt={leaderChangedAt} isLeader={isLeader} currentLeaderName={currentLeaderName} />

      {/* All free-floating overlay cinematics (chicken, OKTA sheep,
          SPECIAL ROUND splash) live in one declarative registry —
          OverlayStage iterates it and mounts whichever signals are
          currently active. Adding a new overlay never touches Room. */}
      <OverlayStage syncedEvent={syncedEvent} />

      {phase === 'revealed' && <RevealBackground players={players} splitMode={splitMode} />}

      {/* The room-start mini-ceremony PM used to mount here with its own
          <PmSprite> wrapper. It now runs through the unified character
          stage (driven by usePmDirector's ceremony mirror) — so no
          duplicate PM DOM and no teleport at ceremony start. */}

      <SlotMachineStage
        pmRoulette={ceremonyForHook} players={players}
        phaseState={slotMachinePhaseState}
      />

      {showResult && phase === 'revealed' && (() => {
        const active = taskList?.activeId ? taskList.items?.[taskList.activeId] : null;
        return (
          <ResultModal
            players={players}
            splitMode={splitMode}
            onNewRound={handleNewRound}
            taskTitle={active?.title || task || ''}
            taskUrl={active?.url || null}
          />
        );
      })()}
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100dvh',
    maxHeight: '100dvh',
    overflow: 'hidden',
    background: '#e8dcc8',
    fontFamily: pixel,
  },
  loading: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100dvh',
    background: '#e8dcc8',
    fontFamily: pixel,
    color: '#888',
  },
  backBtn: {
    marginTop: 20,
    padding: '0.5rem 1rem',
    background: '#d4a853',
    color: '#1e1e2e',
    border: '3px solid #b8922e',
    borderRadius: 0,
    cursor: 'pointer',
    fontSize: '0.6rem',
    fontFamily: pixel,
  },
  reconnectBanner: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    padding: '0.4rem 0.8rem',
    background: '#5a1f1f',
    color: '#ffd76a',
    fontFamily: pixel,
    fontSize: '0.55rem',
    textAlign: 'center',
    borderBottom: '2px solid #2a0e0e',
  },
};
