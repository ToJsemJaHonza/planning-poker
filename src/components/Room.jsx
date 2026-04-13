import { useState, useEffect, useRef, useCallback } from 'react';
import { useRoom } from '../hooks/useRoom';
import { useShameTimer } from '../hooks/useShameTimer';
import { useRoomStartCrowning } from '../hooks/useRoomStartCrowning';
import { useSlotMachine } from '../hooks/useSlotMachine';
import { useCrownOwnership } from '../hooks/useCrownOwnership';
import { usePmPosition } from '../hooks/usePmPosition';
import {
  isValidCeremonyPayload,
  isStalePayload,
} from '../events/slotMachine';
import CardPicker, { SplitCardPicker } from './CardPicker';
import PlayerList from './PlayerList';
import ResultModal from './ResultModal';
import PmSprite from './PmSprite';
import RevealBackground from './RevealBackground';
import Chicken from './Chicken';
import Sheep from './Sheep';
import ShameOverlay from './shame/ShameOverlay';
import SlotMachineStage from './SlotMachineStage';
import RoomHeader from './room/RoomHeader';
import TaskBar from './room/TaskBar';
import PhaseBar from './room/PhaseBar';
import StatusBar from './room/StatusBar';
import LeaderBanner from './room/LeaderBanner';
import SpecialRoundOverlay from './room/SpecialRoundOverlay';
import { pixel } from './room/styles';

export default function Room({ roomCode, playerId, playerName, role = 'player' }) {
  const {
    players, phase, task, splitMode, specialRound,
    pmQuote, setPmQuote,
    oktaEvent, triggerOkta,
    syncedEvent, fireSyncedEvent,
    pmRoulette, resolvePmRoulettePromotion, clearPmRoulette,
    roomStartCrowning, shameTimer, setShameTimer, roomDeleted,
    isLeader, connected, leaderChangedAt, createdAt,
    castVote, castVoteFe, castVoteBe,
    toggleSplit, revealCards, newRound, updateTask,
  } = useRoom(roomCode, playerId, playerName, role);

  // --- Unified PM positioning (JS-driven) ---
  // The usePmPosition hook owns the PM's canonical position.
  // During idle mode it runs a rAF ping-pong walk. When a ceremony starts,
  // it freezes the current position and returns it as `startPos` for the
  // ceremony to use. No more getBoundingClientRect needed.
  const ceremonyActive = !!(pmRoulette || roomStartCrowning);
  const pmPos = usePmPosition({ ceremonyActive });
  const ceremonyStartPos = pmPos.startPos;

  // --- Room-start mini-ceremony ---
  const roomStartState = useRoomStartCrowning({
    roomCode, playerId, role, connected, isLeader,
    players, roomStartCrowning, pmRoulette,
    ceremonyStartPos,
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
    ceremonyStartPos, players,
  });

  const crownOwnership = useCrownOwnership({
    players, slotMachinePhaseState, roomStartState, pmRoulette,
  });

  // --- Derived state ---
  const isPM = role === 'pm';
  const canControl = isLeader;
  const me = players[playerId];
  const myVote = me?.vote || null;
  const myVoteFe = me?.voteFe || null;
  const myVoteBe = me?.voteBe || null;
  const votingPlayers = Object.values(players).filter(p => p.role !== 'pm');
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
        shameHoldoutRef.current = holdoutEntry[0];
        setShameTimer({
          holdoutName: holdout.name,
          holdoutId: holdoutEntry[0],
          startedAt: Date.now(),
        });
      }
    } else {
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

  // --- OKTA easter egg ---
  useEffect(() => {
    if (playerName.toLowerCase() !== 'honza') return;
    const pressed = new Set();
    let clearTimer = null;
    const scheduleClear = () => {
      if (clearTimer) clearTimeout(clearTimer);
      clearTimer = setTimeout(() => pressed.clear(), 2000);
    };
    const check = () => {
      if (pressed.has('o') && pressed.has('k') && pressed.has('t') && pressed.has('a')) {
        triggerOkta();
        pressed.clear();
      }
    };
    const down = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      pressed.add(e.key.toLowerCase());
      check();
      scheduleClear();
    };
    const up = (e) => { pressed.delete(e.key.toLowerCase()); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      if (clearTimer) clearTimeout(clearTimer);
    };
  }, [playerName, triggerOkta]);

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

  if (!connected) {
    return (
      <div style={styles.loading}>
        <p>Connecting to room {roomCode}...</p>
      </div>
    );
  }

  // --- Padding for entrance events ---
  const hasEntrance = syncedEvent && (syncedEvent.type === 'train' || syncedEvent.type === 'dbbPipeline');
  const paddingBottom = hasEntrance ? '380px'
    : isPM ? '80px'
    : canControl ? (splitMode ? '280px' : '240px')
    : (splitMode ? '220px' : '190px');

  return (
    <div style={{ ...styles.container, paddingBottom, transition: 'padding-bottom 0.3s ease' }}>
      {/* Idle PM sprite — hidden during ceremonies. Position driven by
          usePmPosition hook (JS-driven, no CSS keyframes). */}
      {!ceremonyActive && (
        <PmSprite
          isCasting={false}
          onCastComplete={() => {}}
          onQuote={canControl ? setPmQuote : null}
          externalQuote={!canControl ? pmQuote : null}
          position={{ x: pmPos.x, y: pmPos.y }}
          facingLeft={pmPos.facingLeft}
        />
      )}

      <RoomHeader roomCode={roomCode} playerCount={playerCount} />
      <TaskBar task={task} canControl={canControl} phase={phase} onSave={updateTask} />
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
          phaseState={slotMachinePhaseState} crownOwnership={crownOwnership}
          shameTimer={shameTimer} shameStage={shame.stage}
          allVoted={allVotedClean} /* nod animation only for clean votes */
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

      {specialRound && <SpecialRoundOverlay />}

      {/* Easter eggs */}
      {syncedEvent?.type === 'chicken' && <Chicken />}
      {oktaEvent && <Sheep />}

      {phase === 'revealed' && <RevealBackground players={players} splitMode={splitMode} />}

      {/* Room-start crown delivery mini-ceremony */}
      {roomStartState.active && roomStartState.pmPosition && (
        <div
          style={{
            position: 'fixed', left: 0, top: 0,
            width: 60, height: 70,
            transform: `translate(${roomStartState.pmPosition.x - 30}px, ${roomStartState.pmPosition.y - 35}px)`,
            zIndex: 55, pointerEvents: 'none', willChange: 'transform',
          }}
          data-room-start-pm
        >
          <PmSprite
            mode="ceremony"
            pmPose={roomStartState.pmPose}
            crownState={
              crownOwnership.location === 'arcing-to-player'
                ? { mode: 'arcing', progress: crownOwnership.progress }
                : crownOwnership.location === 'materializing'
                  ? { mode: 'materializing', progress: crownOwnership.progress }
                  : null
            }
            crownGlowing={crownOwnership.glowing}
          />
        </div>
      )}

      <SlotMachineStage
        pmRoulette={ceremonyForHook} players={players}
        phaseState={slotMachinePhaseState} crownOwnership={crownOwnership}
      />

      {showResult && phase === 'revealed' && (
        <ResultModal players={players} splitMode={splitMode} onNewRound={handleNewRound} />
      )}
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    maxHeight: '100vh',
    overflow: 'hidden',
    background: '#e8dcc8',
    fontFamily: pixel,
  },
  loading: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
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
};
