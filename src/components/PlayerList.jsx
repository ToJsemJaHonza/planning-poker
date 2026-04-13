import { useRef, useState, useEffect, useMemo } from 'react';
import {
  isRichardName,
  hashDir,
  FUKNAMES,
  RICHARD_HUNGER_QUOTES,
  RICHARD_HUNGER_THRESHOLD_MS,
} from './playerList.utils';
import { useEntranceEvents } from '../events/useEntranceEvents';
import EntranceStage from '../events/EntranceStage';
import PlayerCard from './player/PlayerCard';

const DEV_QUOTES = [
  "It works on my machine",
  "It's not a bug, it's a feature",
  "Have you tried turning it off and on?",
  "// TODO: fix this later",
  "99 bugs in the code... fix one... 127 bugs in the code",
  "There's no place like 127.0.0.1",
  "I don't always test my code, but when I do, I do it in production",
  "git commit -m 'fixed stuff'",
  "Stackoverflow said so",
  "Works on my machine ¯\\_(ツ)_/¯",
  "sudo make me a sandwich",
  "!false — it's funny because it's true",
  "There are 10 types of people...",
  "It compiled! Ship it!",
  "My code doesn't have bugs, it has features",
  "Sleep is for the weak. We have coffee",
  "Real programmers count from 0",
  "The code is self-documenting",
  "I'll refactor this later...",
  "Who needs tests anyway?",
  "Tabs > Spaces. Fight me",
  "In my defense, it passed CI",
  "Can't reproduce. Closing ticket",
  "That's a layer 8 problem",
  "rm -rf node_modules && npm i",
  "Hello world!",
  "null pointer? I barely know her!",
  "Merge conflict. Again.",
  "LGTM 👍",
  "This should be a 2-pointer, right?",
];

export default function PlayerList({ players, phase, currentPlayer, splitMode, syncedEvent, fireSyncedEvent, isLeader, createdAt = 0, pmRoulette = null, phaseState = null, crownOwnership = null }) {
  const playerEntries = Object.entries(players)
    .filter(([, data]) => data.role !== 'pm')
    .sort((a, b) => a[1].joinedAt - b[1].joinedAt);

  // --- Join/leave tracking ---
  const knownRef = useRef(new Set());
  const lastPlayerDataRef = useRef({});
  const [enteringPlayers, setEnteringPlayers] = useState({});
  const [leavingPlayers, setLeavingPlayers] = useState({});

  const { activeEntrance, hiddenPlayers, markArrived, recentArrivals } = useEntranceEvents({
    playerEntries, isLeader, syncedEvent, fireSyncedEvent,
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

  // --- Firebase-synced events ---

  const fukEyesSet = useMemo(
    () => new Set(syncedEvent?.type === 'fukEyes' ? syncedEvent.names : []),
    [syncedEvent]
  );

  useEffect(() => {
    if (!isLeader) return;
    const fuk = [];
    playerEntries.forEach(([, data]) => {
      const displayName = data.name || '';
      if (FUKNAMES.has(displayName.toLowerCase()) && Math.random() < 0.1) {
        fuk.push(displayName);
      }
    });
    if (fuk.length > 0) {
      fireSyncedEvent?.({ type: 'fukEyes', names: fuk }, 60000);
    }
  }, [phase, isLeader]);

  useEffect(() => {
    if (!isLeader || phase !== 'revealed') return;
    playerEntries.forEach(([, data]) => {
      const displayName = data.name || '';
      if (displayName.toLowerCase() === 'alan' && data.vote === '☕' && Math.random() < 0.1) {
        setTimeout(() => {
          fireSyncedEvent?.({ type: 'devQuote', name: displayName, text: 'Fullstack FE developer' }, 4000);
        }, 1500);
      }
    });
  }, [phase, isLeader]);

  const activeQuote = syncedEvent?.type === 'devQuote' ? syncedEvent : null;

  useEffect(() => {
    if (!isLeader) return;
    const names = playerEntries.map(([, data]) => data.name).filter(Boolean);
    if (names.length === 0) return;
    const interval = setInterval(() => {
      if (syncedEvent) return;
      if (Math.random() < 0.02) {
        const name = names[Math.floor(Math.random() * names.length)];
        const text = DEV_QUOTES[Math.floor(Math.random() * DEV_QUOTES.length)];
        fireSyncedEvent?.({ type: 'devQuote', name, text }, 3000);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [playerEntries.length, isLeader, syncedEvent]);

  useEffect(() => {
    if (!isLeader || typeof createdAt !== 'number' || !createdAt) return;
    const richardEntry = playerEntries.find(([, data]) => isRichardName(data.name));
    if (!richardEntry) return;
    const interval = setInterval(() => {
      if (syncedEvent) return;
      const age = Date.now() - createdAt;
      if (age < RICHARD_HUNGER_THRESHOLD_MS) return;
      if (Math.random() >= 0.4) return;
      const text = RICHARD_HUNGER_QUOTES[Math.floor(Math.random() * RICHARD_HUNGER_QUOTES.length)];
      fireSyncedEvent?.({ type: 'devQuote', name: richardEntry[1].name, text }, 4000);
    }, 15000);
    return () => clearInterval(interval);
  }, [isLeader, createdAt, playerEntries.length, syncedEvent]);

  // --- Act 1: Outgoing leader figure retention ---
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

  // --- Helpers for PlayerCard props ---
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

    return {
      id, data, currentPlayer, phase, splitMode,
      activeQuote, fukEyes, showCrown,
      justArrived: recentArrivals.has(id),
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
        {/* Synthetic outgoing leader during Act 1 crown removal */}
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
        {playerEntries.map(([id, data]) => {
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
                })} />
              </div>
            );
          }

          const enterInfo = enteringPlayers[id];
          return <PlayerCard key={id} {...getPlayerCardProps(id, data, {
            className: enterInfo ? `player-walk-in-${enterInfo.dir}` : '',
            style: enterInfo ? { '--enter-duration': `${enterInfo.duration}s` } : {},
            walking: !!enterInfo,
          })} />;
        })}

        {/* Leaving players — frozen last-known figure walks off */}
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
