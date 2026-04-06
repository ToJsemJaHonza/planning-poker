import { useState, useCallback, useEffect } from 'react';
import { useRoom } from '../hooks/useRoom';
import CardPicker, { SplitCardPicker } from './CardPicker';
import PlayerList from './PlayerList';
import ResultModal from './ResultModal';
import Wizard from './Wizard';

export default function Room({ roomCode, playerName, role = 'player' }) {
  const {
    players,
    phase,
    task,
    splitMode,
    specialRound,
    isLeader,
    connected,
    castVote,
    castVoteFe,
    castVoteBe,
    toggleSplit,
    revealCards,
    newRound,
    updateTask,
  } = useRoom(roomCode, playerName, role);

  const isPM = role === 'pm';
  const canControl = isLeader; // creator always has control (player or PM)

  const [editingTask, setEditingTask] = useState(false);
  const [taskDraft, setTaskDraft] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [copied, setCopied] = useState(false);
  const [casting, setCasting] = useState(false);

  const me = players[playerName];
  const myVote = me?.vote || null;
  const myVoteFe = me?.voteFe || null;
  const myVoteBe = me?.voteBe || null;
  const votingPlayers = Object.values(players).filter(p => p.role !== 'pm');
  const playerCount = votingPlayers.length;

  // Count voted players (exclude PM)
  const votedCount = splitMode
    ? votingPlayers.filter(p => p.voteFe != null && p.voteBe != null).length
    : votingPlayers.filter(p => p.vote != null).length;

  const handleReveal = () => {
    setCasting(true);
  };

  const handleCastComplete = useCallback(async () => {
    setCasting(false);
    await revealCards();
    setTimeout(() => setShowResult(true), 800);
  }, [revealCards]);

  useEffect(() => {
    if (!isLeader && casting) setCasting(false);
  }, [isLeader, casting]);

  const handleNewRound = () => {
    setShowResult(false);
    newRound();
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?room=${roomCode}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
    <div style={{ ...styles.container, paddingBottom: isPM ? '80px' : canControl ? (splitMode ? '280px' : '240px') : (splitMode ? '220px' : '190px') }}>
      {canControl && (
        <Wizard isCasting={casting} onCastComplete={handleCastComplete} />
      )}

      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <h2 style={styles.roomTitle}>Room: {roomCode}</h2>
          <span style={styles.playerCount}>{playerCount} players</span>
        </div>
        <div style={styles.headerRight}>
          <button onClick={handleCopyLink} style={styles.copyBtn}>
            {copied ? '✓ Copied' : '📋 Invite'}
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
              onKeyDown={(e) => e.key === 'Enter' && handleTaskSave()}
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
              disabled={votedCount === 0 || casting}
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
        currentPlayer={playerName}
        splitMode={splitMode}
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
};
