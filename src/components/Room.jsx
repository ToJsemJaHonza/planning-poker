import { useState, useEffect } from 'react';
import { useRoom } from '../hooks/useRoom';
import CardPicker, { SplitCardPicker } from './CardPicker';
import PlayerList from './PlayerList';
import ResultModal from './ResultModal';
import Wizard from './Wizard';
import RevealBackground from './RevealBackground';
import Chicken from './Chicken';
import Sheep from './Sheep';

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

export default function Room({ roomCode, playerId, playerName, role = 'player' }) {
  const {
    players,
    phase,
    task,
    splitMode,
    specialRound,
    pmQuote,
    setPmQuote,
    oktaEvent,
    triggerOkta,
    syncedEvent,
    fireSyncedEvent,
    isLeader,
    connected,
    leaderChangedAt,
    createdAt,
    castVote,
    castVoteFe,
    castVoteBe,
    toggleSplit,
    revealCards,
    newRound,
    updateTask,
  } = useRoom(roomCode, playerId, playerName, role);

  const isPM = role === 'pm';
  const canControl = isLeader; // creator always has control (player or PM)

  const [editingTask, setEditingTask] = useState(false);
  const [taskDraft, setTaskDraft] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [showLeaderBanner, setShowLeaderBanner] = useState(false);

  // Y3 — close task editor whenever we leave the voting phase
  useEffect(() => {
    if (phase !== 'voting') setEditingTask(false);
  }, [phase]);

  // Surface a short banner whenever leadership changes (old owner left)
  useEffect(() => {
    if (!leaderChangedAt) return;
    setShowLeaderBanner(true);
    const t = setTimeout(() => setShowLeaderBanner(false), 4500);
    return () => clearTimeout(t);
  }, [leaderChangedAt]);

  // Find who the current leader is, so the banner can name them.
  // Players are keyed by ID, so pull the display name off the entry itself.
  const currentLeaderName = Object.values(players).find((p) => p.isLeader)?.name;

  const me = players[playerId];
  const myVote = me?.vote || null;
  const myVoteFe = me?.voteFe || null;
  const myVoteBe = me?.voteBe || null;
  const votingPlayers = Object.values(players).filter(p => p.role !== 'pm');
  const playerCount = votingPlayers.length;

  // Count voted players (exclude PM)
  const votedCount = splitMode
    ? votingPlayers.filter(p => p.voteFe != null && p.voteBe != null).length
    : votingPlayers.filter(p => p.vote != null).length;

  const handleReveal = async () => {
    await revealCards();
    // 1% chance chicken easter egg — synced via Firebase
    if (Math.random() < 0.01) {
      fireSyncedEvent({ type: 'chicken' }, 3500);
    }
    setTimeout(() => setShowResult(true), 300);
  };

  // OKTA easter egg — only for "Honza", detect O+K+T+A keys held together.
  // P6: ignore modifiers (ctrl/meta/alt), ignore autorepeat, and soft-clear
  // the pressed set after 2s of inactivity so ghost keyups never brick it.
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

  const handleNewRound = () => {
    setShowResult(false);
    newRound();
  };

  const handleCopyLink = async () => {
    const url = `${window.location.origin}${window.location.pathname}?room=${roomCode}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setCopyError(false);
    } catch {
      setCopied(false);
      setCopyError(true);
    }
    setTimeout(() => { setCopied(false); setCopyError(false); }, 2000);
  };

  const handleTaskEdit = () => {
    if (!canControl) return;
    setTaskDraft(task);
    setEditingTask(true);
  };

  const handleTaskSave = () => {
    updateTask(taskDraft);
    setEditingTask(false);
  };

  if (!connected) {
    return (
      <div style={styles.loading}>
        <p>Connecting to room {roomCode}...</p>
      </div>
    );
  }

  return (
    <div style={{
      ...styles.container,
      // Entrance events (train, dbbPipeline) float above the bottom UI strip.
      // Push the player grid down so its figures don't overlap the train/pipe.
      paddingBottom:
        syncedEvent && (syncedEvent.type === 'train' || syncedEvent.type === 'dbbPipeline')
          ? '380px'
          : isPM ? '80px' : canControl ? (splitMode ? '280px' : '240px') : (splitMode ? '220px' : '190px'),
      transition: 'padding-bottom 0.3s ease',
    }}>
      {/* PM sprite visible to ALL players */}
      <Wizard
        isCasting={false}
        onCastComplete={() => {}}
        onQuote={canControl ? setPmQuote : null}
        externalQuote={!canControl ? pmQuote : null}
      />

      {/* Header */}
      <div style={styles.header} data-room-header>
        <div style={styles.headerLeft} data-header-left>
          <h2 style={styles.roomTitle} data-room-title>Room: {roomCode}</h2>
          <span style={styles.playerCount} data-player-count>{plural(playerCount, 'player')}</span>
        </div>
        <div style={styles.headerRight}>
          <button onClick={handleCopyLink} style={styles.copyBtn} data-copy-btn>
            {copied ? '✓ Copied' : copyError ? '✗ Copy failed' : '📋 Invite'}
          </button>
        </div>
      </div>

      {/* Task */}
      <div style={styles.taskBar}>
        {editingTask ? (
          <div style={styles.taskEdit}>
            <input
              value={taskDraft}
              onChange={(e) => setTaskDraft(e.target.value)}
              placeholder="Task name..."
              style={styles.taskInput}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleTaskSave();
                else if (e.key === 'Escape') { setEditingTask(false); setTaskDraft(''); }
              }}
            />
            <button onClick={handleTaskSave} style={styles.taskSaveBtn}>✓</button>
          </div>
        ) : (
          <div onClick={handleTaskEdit} style={{
            ...styles.taskDisplay,
            cursor: canControl ? 'pointer' : 'default',
          }}>
            {task || (canControl ? 'Click to set task...' : 'No task')}
          </div>
        )}
      </div>

      {/* Phase indicator */}
      <div style={styles.phaseBar}>
        <span style={styles.phaseLabel}>
          {phase === 'voting'
            ? `Voting (${votedCount}/${playerCount})${splitMode ? ' FE/BE' : ''}`
            : 'Results'}
        </span>

        {canControl && phase === 'voting' && (
          <>
            <button
              onClick={toggleSplit}
              style={{
                ...styles.splitBtn,
                ...(splitMode ? styles.splitBtnActive : {}),
              }}
            >
              {splitMode ? '✂ FE/BE' : '✂ Split'}
            </button>
            <button
              onClick={handleReveal}
              style={styles.revealBtn}
              disabled={votedCount === 0}
            >
              Reveal Cards
            </button>
          </>
        )}
        {canControl && phase === 'revealed' && (
          <button onClick={handleNewRound} style={styles.newRoundBtn}>
            New Round
          </button>
        )}
      </div>

      {/* Players */}
      <PlayerList
        players={players}
        phase={phase}
        currentPlayer={playerId}
        splitMode={splitMode}
        syncedEvent={syncedEvent}
        fireSyncedEvent={fireSyncedEvent}
        isLeader={isLeader}
        createdAt={createdAt}
      />

      {/* Card picker — only for players, not PM */}
      {!isPM && phase === 'voting' && !splitMode && (
        <CardPicker
          selectedVote={myVote}
          onVote={castVote}
          disabled={false}
          bottomOffset={canControl ? 40 : 0}
        />
      )}
      {!isPM && phase === 'voting' && splitMode && (
        <SplitCardPicker
          voteFe={myVoteFe}
          voteBe={myVoteBe}
          onVoteFe={castVoteFe}
          onVoteBe={castVoteBe}
          disabled={false}
          bottomOffset={canControl ? 40 : 0}
        />
      )}

      {/* Status bar — for any leader (PM or player-leader) */}
      {canControl && phase === 'voting' && (
        <div style={styles.pmBar}>
          <span style={styles.pmBarText}>
            {votedCount === playerCount && playerCount > 0
              ? '✓ Everyone voted!'
              : `Waiting for ${playerCount - votedCount} player${playerCount - votedCount === 1 ? '' : 's'}...`}
          </span>
          <span style={styles.pmBarCount}>{votedCount} / {playerCount}</span>
        </div>
      )}
      {canControl && phase === 'revealed' && (
        <div style={styles.pmBar}>
          <span style={styles.pmBarText}>Results revealed</span>
        </div>
      )}

      {/* Leader takeover banner — old owner disconnected, someone else took the crown */}
      {showLeaderBanner && currentLeaderName && (
        <div style={styles.leaderBanner} data-testid="leader-banner">
          <span style={styles.leaderBannerText}>
            👑 {isLeader ? 'You are now the leader' : `${currentLeaderName} is now the leader`}
          </span>
        </div>
      )}

      {/* SPECIAL ROUND overlay — synced via Firebase, visible to all */}
      {specialRound && (
        <div style={styles.specialOverlay}>
          <div style={styles.specialContent}>
            <div style={styles.specialStars}>✦ ✦ ✦</div>
            <div style={styles.specialText}>SPECIAL</div>
            <div style={styles.specialText2}>ROUND!</div>
            <div style={styles.specialSub}>FE / BE</div>
            <div style={styles.specialStars}>✦ ✦ ✦</div>
          </div>
        </div>
      )}

      {/* Easter eggs — all synced via Firebase */}
      {syncedEvent?.type === 'chicken' && <Chicken />}
      {oktaEvent && <Sheep />}

      {/* Reveal background numbers */}
      {phase === 'revealed' && (
        <RevealBackground players={players} splitMode={splitMode} />
      )}

      {/* Result modal */}
      {showResult && phase === 'revealed' && (
        <ResultModal
          players={players}
          splitMode={splitMode}
          onNewRound={handleNewRound}
        />
      )}
    </div>
  );
}

const pixel = "'Press Start 2P', monospace";

const styles = {
  container: {
    minHeight: '100vh',
    background: '#e8dcc8',
    fontFamily: pixel,
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    background: '#e8dcc8',
    fontFamily: pixel,
    color: '#888',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.6rem 1rem',
    borderBottom: '4px solid #d4a853',
    background: '#f5f0e4',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.8rem',
  },
  roomTitle: {
    margin: 0,
    fontSize: '0.85rem',
    color: '#d4a853',
  },
  playerCount: {
    fontSize: '0.65rem',
    color: '#888',
    fontFamily: pixel,
  },
  headerRight: {
    display: 'flex',
    gap: '0.5rem',
  },
  copyBtn: {
    padding: '0.4rem 0.6rem',
    background: '#d4a853',
    color: '#1e1e2e',
    border: '3px solid #b8922e',
    borderRadius: '0',
    cursor: 'pointer',
    fontSize: '0.6rem',
    fontFamily: pixel,
  },
  taskBar: {
    padding: '0.5rem 1rem',
    borderBottom: '3px solid #d0c4ae',
    background: '#f0ead8',
  },
  taskDisplay: {
    fontSize: '0.65rem',
    color: '#888',
    padding: '0.3rem 0',
  },
  taskEdit: {
    display: 'flex',
    gap: '0.5rem',
  },
  taskInput: {
    flex: 1,
    padding: '0.4rem 0.6rem',
    fontSize: '0.65rem',
    border: '3px solid #d4a853',
    borderRadius: '0',
    fontFamily: pixel,
    outline: 'none',
    background: '#f5f0e4',
    color: '#2a2a3a',
  },
  taskSaveBtn: {
    padding: '0.4rem 0.6rem',
    background: '#d4a853',
    color: '#1e1e2e',
    border: '3px solid #b8922e',
    borderRadius: '0',
    cursor: 'pointer',
    fontSize: '0.65rem',
    fontFamily: pixel,
  },
  phaseBar: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '0.6rem',
    padding: '0.8rem',
    flexWrap: 'wrap',
  },
  phaseLabel: {
    fontSize: '0.65rem',
    color: '#888',
    fontFamily: pixel,
  },
  splitBtn: {
    padding: '0.4rem 0.6rem',
    background: '#f5f0e4',
    color: '#888',
    border: '3px solid #ccc',
    borderRadius: '0',
    cursor: 'pointer',
    fontSize: '0.55rem',
    fontFamily: pixel,
  },
  splitBtnActive: {
    background: '#3498db',
    color: '#fff',
    border: '3px solid #2980b9',
  },
  revealBtn: {
    padding: '0.5rem 1rem',
    background: '#d4a853',
    color: '#1e1e2e',
    border: '3px solid #b8922e',
    borderRadius: '0',
    cursor: 'pointer',
    fontSize: '0.65rem',
    fontFamily: pixel,
  },
  newRoundBtn: {
    padding: '0.5rem 1rem',
    background: '#4caf50',
    color: '#1e1e2e',
    border: '3px solid #3a8a3e',
    borderRadius: '0',
    cursor: 'pointer',
    fontSize: '0.65rem',
    fontFamily: pixel,
  },
  // PM status bar at bottom
  pmBar: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    padding: '0.5rem 1rem',
    background: '#2a2a3a',
    borderTop: '4px solid #d4a853',
    zIndex: 41,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '1.5rem',
  },
  pmBarText: {
    fontSize: '0.85rem',
    fontFamily: pixel,
    color: '#d4a853',
    letterSpacing: '1px',
  },
  pmBarCount: {
    fontSize: '1.2rem',
    fontFamily: pixel,
    color: '#fff',
  },
  // SPECIAL ROUND overlay
  specialOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.85)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
    animation: 'specialFade 2.2s ease-in-out forwards',
  },
  specialContent: {
    textAlign: 'center',
    animation: 'specialZoom 0.6s ease-out',
  },
  specialStars: {
    fontSize: '1.5rem',
    color: '#f5c542',
    letterSpacing: '12px',
    margin: '0.3rem 0',
    animation: 'specialPulse 0.8s ease-in-out infinite',
  },
  specialText: {
    fontSize: '2.5rem',
    fontFamily: pixel,
    color: '#f5c542',
    textShadow: '4px 4px 0 #b8922e, -2px -2px 0 #fff3',
    letterSpacing: '6px',
  },
  specialText2: {
    fontSize: '2.5rem',
    fontFamily: pixel,
    color: '#fff',
    textShadow: '4px 4px 0 #333, -2px -2px 0 #fff3',
    letterSpacing: '6px',
  },
  specialSub: {
    fontSize: '1rem',
    fontFamily: pixel,
    color: '#3498db',
    marginTop: '0.5rem',
    textShadow: '2px 2px 0 #1a3a5a',
    letterSpacing: '8px',
  },
  leaderBanner: {
    position: 'fixed',
    top: 80,
    left: '50%',
    transform: 'translateX(-50%)',
    background: '#2a2a3a',
    border: '4px solid #d4a853',
    color: '#d4a853',
    padding: '10px 18px',
    fontSize: '0.7rem',
    fontFamily: pixel,
    boxShadow: '4px 4px 0 #b8922e',
    zIndex: 190,
    letterSpacing: '1px',
    animation: 'specialFade 4.5s ease-in-out forwards',
  },
  leaderBannerText: {
    fontFamily: pixel,
  },
};
