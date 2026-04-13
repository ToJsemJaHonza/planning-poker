import { useRef, useState, useEffect } from 'react';
import { hashDir } from './playerList.utils';
import { useEntranceEvents } from '../events/useEntranceEvents';
import { useAmbientEvents } from '../hooks/useAmbientEvents';
import EntranceStage from '../events/EntranceStage';
import PlayerCard from './player/PlayerCard';

export default function PlayerList({ players, phase, currentPlayer, splitMode, syncedEvent, fireSyncedEvent, isLeader, createdAt = 0, pmRoulette = null, phaseState = null, crownOwnership = null, shameTimer = null, shameStage = 0, shameElapsed = 0, allVoted = false }) {
  const playerEntries = Object.entries(players)
    .filter(([, data]) => data.role !== 'pm')
    .sort((a, b) => a[1].joinedAt - b[1].joinedAt);

  // --- Act 1: Outgoing leader figure retention ---
  // Defined before join/leave tracking so the guards below can reference
  // outgoingId and isInCrownRemoval to prevent duplicate figures.
  const outgoingId = pmRoulette?.outgoingLeaderId || null;
  const outgoingData = pmRoulette?.outgoingLeaderLastData || null;

  const [crownRemovalElapsed, setCrownRemovalElapsed] = useState(0);
  useEffect(() => {
    if (!pmRoulette?.startedAt) { setCrownRemovalElapsed(0); return; }
    const tick = () => setCrownRemovalElapsed(Date.now() - pmRoulette.startedAt);
    tick();
    const id = setInterval(tick, 50);
    const timeout = setTimeout(() => clearInterval(id), 5500);
    return () => { clearInterval(id); clearTimeout(timeout); };
  }, [pmRoulette?.ceremonyId, pmRoulette?.startedAt]);

  const isInCrownRemoval = pmRoulette && crownRemovalElapsed < 5000;
  const leaderWalkOff = crownRemovalElapsed >= 3000;

  // --- Join/leave tracking ---
  const knownRef = useRef(new Set());
  const lastPlayerDataRef = useRef({});
  const [enteringPlayers, setEnteringPlayers] = useState({});
  const [leavingPlayers, setLeavingPlayers] = useState({});

  const { activeEntrance, hiddenPlayers, markArrived, recentArrivals } = useEntranceEvents({
    playerEntries, isLeader, syncedEvent, fireSyncedEvent,
  });

  // Ambient events (fuk eyes, dev quotes, Alan coffee, Richard hunger)
  // run only on the leader client; all results synced via Firebase.
  const { fukEyesSet, activeQuote } = useAmbientEvents({
    playerEntries, phase, isLeader, syncedEvent, fireSyncedEvent, createdAt,
  });

  useEffect(() => {
    const currentIds = playerEntries.map(([id]) => id);
    const currentSet = new Set(currentIds);
    const newPlayers = {};
    const gonePlayers = {};

    playerEntries.forEach(([id, data]) => {
      lastPlayerDataRef.current[id] = data;
    });

    let maxDuration = 0;
    for (const id of currentIds) {
      if (!knownRef.current.has(id)) {
        if (hiddenPlayers.has(id)) continue;
        const displayName = lastPlayerDataRef.current[id]?.name || id;
        const info = hashDir(displayName);
        newPlayers[id] = info;
        if (info.duration > maxDuration) maxDuration = info.duration;
      }
    }

    for (const id of knownRef.current) {
      if (!currentSet.has(id)) {
        // Skip players whose exit is handled by the crown ceremony.
        // The pmRoulette ceremony renders a "synthetic leader" figure that
        // manages its own walk-off animation. Adding the same player to
        // leavingPlayers would render a duplicate figure.
        if (pmRoulette?.outgoingLeaderId === id) continue;
        if (crownOwnership?.playerId === id) continue;
        const data = lastPlayerDataRef.current[id] || { name: id };
        const info = hashDir(data.name || id);
        const exitDir = info.dir === 'left' ? 'right' : 'left';
        gonePlayers[id] = { info: { dir: exitDir, duration: info.duration }, data };
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
  }, [playerEntries.map(([id]) => id).join(',')]);

  // If a ceremony starts targeting a player that's already in leavingPlayers,
  // remove them immediately to avoid rendering both the leaving animation and
  // the synthetic leader figure simultaneously.
  useEffect(() => {
    if (!outgoingId) return;
    setLeavingPlayers(prev => {
      if (!prev[outgoingId]) return prev;
      const next = { ...prev };
      delete next[outgoingId];
      return next;
    });
  }, [outgoingId]);

  // --- PlayerCard props factory ---
  const getPlayerCardProps = (id, data, opts = {}) => {
    const displayName = data.name || id;
    const isNonMatchRelief = !opts.isSyntheticLeader
      && phaseState?.nonMatchRelief
      && phaseState.nonMatchReliefPlayerId === id;
    const fukEyes = !opts.isSyntheticLeader && (fukEyesSet.has(displayName) || isNonMatchRelief);
    const showCrown = crownOwnership
      ? crownOwnership.location === 'player-head' && crownOwnership.playerId === id
        && !opts.keySuffix?.includes('leaving')
      : false;

    // Shame timer: determine if this player is the holdout
    const playerStressStage = shameTimer && shameTimer.holdoutId === id ? shameStage : 0;

    return {
      id, data, currentPlayer, phase, splitMode,
      activeQuote, fukEyes, showCrown,
      justArrived: recentArrivals.has(id),
      allVoted, stressStage: playerStressStage, shameElapsed: playerStressStage > 0 ? shameElapsed : 0,
      ...opts,
    };
  };

  const handlePlayerExit = () => {
    const hiddenId = activeEntrance?.event.getHiddenPlayer?.(activeEntrance.payload);
    if (hiddenId) markArrived(hiddenId);
  };

  return (
    <div style={styles.container}>
      <EntranceStage activeEntrance={activeEntrance} onPlayerExit={handlePlayerExit} />

      <div style={styles.grid}>
        {/* Synthetic outgoing leader during Act 1 */}
        {outgoingId && outgoingData && outgoingData.role !== 'pm'
          && isInCrownRemoval
          && !playerEntries.some(([id]) => id === outgoingId)
          && <PlayerCard {...getPlayerCardProps(outgoingId, { ...outgoingData, isLeader: !leaderWalkOff }, {
            keySuffix: '__synthetic-leader',
            isSyntheticLeader: true,
            testIdOverride: `player-${outgoingData.name}-outgoing`,
            className: leaderWalkOff ? `player-walk-out-${hashDir(outgoingData.name || '').dir === 'left' ? 'right' : 'left'}` : '',
            style: leaderWalkOff ? { '--enter-duration': '0.6s' } : {},
            walking: !!leaderWalkOff,
          })} />
        }

        {/* Active player grid */}
        {playerEntries.map(([id, data], index) => {
          if (hiddenPlayers.has(id)) {
            const displayName = data.name || id;
            return (
              <div
                key={id}
                style={{ visibility: 'hidden', minHeight: 100, display: 'flex' }}
                data-entrance-target={id}
              >
                <PlayerCard {...getPlayerCardProps(id, data, {
                  keySuffix: '__placeholder',
                  testIdOverride: `player-${displayName}-placeholder`,
                  playerIndex: index,
                })} />
              </div>
            );
          }

          const enterInfo = enteringPlayers[id];
          const isHoldout = shameTimer && shameTimer.holdoutId === id && shameStage > 0;
          const trembleClass = isHoldout ? `shame-tremble-${Math.min(shameStage, 5)}` : '';
          const nodClass = allVoted && !enterInfo ? 'player-nod' : '';
          const extraClass = [
            enterInfo ? `player-walk-in-${enterInfo.dir}` : '',
            trembleClass,
            nodClass,
          ].filter(Boolean).join(' ');

          return <PlayerCard key={id} {...getPlayerCardProps(id, data, {
            className: extraClass,
            style: {
              ...(enterInfo ? { '--enter-duration': `${enterInfo.duration}s` } : {}),
              ...(nodClass ? { animationDelay: `${index * 60}ms` } : {}),
            },
            walking: !!enterInfo,
            playerIndex: index,
          })} />;
        })}

        {/* Leaving players */}
        {Object.entries(leavingPlayers).map(([id, { info, data }]) => (
          <PlayerCard key={id + '__leaving'} {...getPlayerCardProps(id, data, {
            className: `player-walk-out-${info.dir}`,
            style: { '--enter-duration': `${info.duration}s` },
            keySuffix: '__leaving',
            walking: true,
          })} />
        ))}
      </div>
    </div>
  );
}

const styles = {
  container: { padding: '1.5rem 1rem' },
  grid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '16px 28px',
    justifyContent: 'center',
  },
};
