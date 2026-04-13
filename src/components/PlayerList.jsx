import { useRef, useState, useEffect, useMemo } from 'react';
import PlayerFigure from './PlayerFigure';
import {
  isRichardName,
  hashDir,
  FUKNAMES,
  RICHARD_HUNGER_QUOTES,
  RICHARD_HUNGER_THRESHOLD_MS,
} from './playerList.utils';
import { useEntranceEvents } from '../events/useEntranceEvents';
import EntranceStage from '../events/EntranceStage';

const pixel = "'Press Start 2P', monospace";

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


// A figure that actually moves its legs — uses JS setInterval to toggle
// between the two walk-cycle sprite frames (the same pattern Wizard uses).
// MUST be declared at module scope — if defined inside PlayerList, React
// treats each render as a new component type and unmounts/remounts on
// every parent re-render, so the interval never has time to tick.
function WalkingFigure({ name, fukEyes, showCrown }) {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    // 500 ms per frame, matching the PM (Wizard) walk cadence.
    const id = setInterval(() => setFrame(f => f ^ 1), 500);
    return () => clearInterval(id);
  }, []);
  return <PlayerFigure name={name} holdingCard={false} fukEyes={fukEyes} walkFrame={frame} showCrown={showCrown} />;
}

export default function PlayerList({ players, phase, currentPlayer, splitMode, syncedEvent, fireSyncedEvent, isLeader, createdAt = 0, pmRoulette = null, phaseState = null, crownOwnership = null }) {
  // Entries are [playerId, data]; `data.name` holds the display name.
  // Players are keyed by a per-tab session ID so two browsers with the same
  // display name coexist as separate entries — everything below (join/leave
  // animation tracking, easter-egg matching, entrance triggers) keys off the
  // ID, not the name, so duplicates never collide.
  const playerEntries = Object.entries(players)
    .filter(([, data]) => data.role !== 'pm')
    .sort((a, b) => a[1].joinedAt - b[1].joinedAt);

  // Track known player IDs to detect new joins / leaves. Keying these off
  // the ID means two same-named players are tracked independently.
  const knownRef = useRef(new Set());
  const lastPlayerDataRef = useRef({}); // keep last seen data for disconnecting players, keyed by ID
  const [enteringPlayers, setEnteringPlayers] = useState({});
  const [leavingPlayers, setLeavingPlayers] = useState({}); // { id: { data, dir } }

  // All cinematic entrance events go through the unified engine. It handles
  // trigger detection (leader-only), mutex, and derives which players need
  // to be hidden from the grid while their event plays.
  const { activeEntrance, hiddenPlayers, markArrived, recentArrivals } = useEntranceEvents({
    playerEntries,
    isLeader,
    syncedEvent,
    fireSyncedEvent,
  });

  useEffect(() => {
    const currentIds = playerEntries.map(([id]) => id);
    const currentSet = new Set(currentIds);
    const newPlayers = {};
    const gonePlayers = {};

    // Remember latest data for everyone currently present (keyed by ID)
    playerEntries.forEach(([id, data]) => {
      lastPlayerDataRef.current[id] = data;
    });

    let maxDuration = 0;
    for (const id of currentIds) {
      if (!knownRef.current.has(id)) {
        // If the engine is currently hiding this player (they're in the
        // middle of their cinematic entrance), don't ALSO queue them as a
        // normal walk-in — the cinematic IS their grand arrival.
        if (hiddenPlayers.has(id)) continue;
        // Hash on the display name so two same-named players still look
        // consistent with themselves visually even though the ID varies.
        const displayName = lastPlayerDataRef.current[id]?.name || id;
        const info = hashDir(displayName);
        newPlayers[id] = info;
        if (info.duration > maxDuration) maxDuration = info.duration;
      }
    }

    // Detect disconnected players — they should walk off instead of vanishing
    for (const id of knownRef.current) {
      if (!currentSet.has(id)) {
        // Outgoing leader of an active ceremony can't walk off — the
        // ceremony's synthetic figure and timed walk-off handle their exit.
        // This guard is timing-immune: outgoingLeaderId is set once in the
        // payload and never changes, unlike crownOwnership.location which
        // transitions through phases and caused race conditions.
        if (pmRoulette?.outgoingLeaderId === id) continue;
        if (crownOwnership?.playerId === id) continue;

        const data = lastPlayerDataRef.current[id] || { name: id };
        const info = hashDir(data.name || id);
        // Exit in the opposite direction they came from for a "walked through" feel
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
      const exitMaxDuration = Math.max(
        ...Object.values(gonePlayers).map(g => g.info.duration)
      );
      const goneIds = Object.keys(gonePlayers);
      setTimeout(() => {
        setLeavingPlayers(prev => {
          const next = { ...prev };
          goneIds.forEach(k => delete next[k]);
          return next;
        });
        // Also drop their last-known data
        goneIds.forEach(k => delete lastPlayerDataRef.current[k]);
      }, (exitMaxDuration + 0.3) * 1000);
    }

    knownRef.current = currentSet;
  }, [playerEntries.map(([id]) => id).join(',')]);

  // === ALL EVENTS SYNCED VIA FIREBASE (leader decides, all clients render) ===

  // Fuk eyes — leader decides on phase change, writes to Firebase.
  // Matches on display name (`data.name`), but the event payload stores the
  // matched display names — the event only affects players by name, and is
  // intentionally "fuzzy" in the same way the easter egg has always been.
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
      fireSyncedEvent?.({ type: 'fukEyes', names: fuk }, 60000); // lasts until next round
    }
  }, [phase, isLeader]);


  // Alan coffee — leader fires on reveal
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

  // Dev quotes — leader triggers, 2% chance every 3s.
  // devQuote payload stores a display name; the speech bubble renderer below
  // matches it against `data.name` for whichever player is currently being
  // iterated, so with two same-named players they both light up — acceptable
  // since the payload itself is display-name based and historically always was.
  const activeQuote = syncedEvent?.type === 'devQuote' ? syncedEvent : null;
  useEffect(() => {
    if (!isLeader) return;
    const names = playerEntries.map(([, data]) => data.name).filter(Boolean);
    if (names.length === 0) return;
    const interval = setInterval(() => {
      if (syncedEvent) return; // something already showing
      if (Math.random() < 0.02) {
        const name = names[Math.floor(Math.random() * names.length)];
        const text = DEV_QUOTES[Math.floor(Math.random() * DEV_QUOTES.length)];
        fireSyncedEvent?.({ type: 'devQuote', name, text }, 3000);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [playerEntries.length, isLeader, syncedEvent]);

  // GH issue #1 — "Richard is hungry". If the room has been open for more than
  // an hour and there's a Richard in the voter list, the leader periodically
  // makes him speak a hunger quote. Synced via Firebase so every client sees
  // the same quote at the same time.
  useEffect(() => {
    if (!isLeader || typeof createdAt !== 'number' || !createdAt) return;
    const richardEntry = playerEntries.find(([, data]) => isRichardName(data.name));
    if (!richardEntry) return;
    const interval = setInterval(() => {
      if (syncedEvent) return; // something already showing — don't stomp on it
      const age = Date.now() - createdAt;
      if (age < RICHARD_HUNGER_THRESHOLD_MS) return;
      // 40% chance per tick so Richard complains visibly often once he's hungry
      if (Math.random() >= 0.4) return;
      const text = RICHARD_HUNGER_QUOTES[Math.floor(Math.random() * RICHARD_HUNGER_QUOTES.length)];
      fireSyncedEvent?.({ type: 'devQuote', name: richardEntry[1].name, text }, 4000);
    }, 15000);
    return () => clearInterval(interval);
  }, [isLeader, createdAt, playerEntries.length, syncedEvent]);

  // Tomáš DBB trigger is handled in the unified entrance dispatcher above
  // (same useEffect as Richard's train) so the two are mutually exclusive.

  // iter 4: Leader figure retention during Act 1 (crownRemoval phase).
  // When a pmRoulette ceremony is active, the outgoing leader's figure stays
  // from payload data (not live players) until 1500ms after ceremony start
  // (when PM takes the crown). After that, the figure walks off.
  // No rendering during Acts 2+3 (ghost eliminated).
  const outgoingId = pmRoulette?.outgoingLeaderId || null;
  const outgoingData = pmRoulette?.outgoingLeaderLastData || null;
  const outgoingHadCrown = pmRoulette?.outgoingLeaderHadCrown || false;

  // Derive crown-removal state from ceremony timing (deterministic).
  // crownRemoval phase is t=0 to t=2500ms from ceremony start.
  const [crownRemovalElapsed, setCrownRemovalElapsed] = useState(0);
  useEffect(() => {
    if (!pmRoulette?.startedAt) { setCrownRemovalElapsed(0); return; }
    const tick = () => {
      const elapsed = Date.now() - pmRoulette.startedAt;
      setCrownRemovalElapsed(elapsed);
    };
    tick();
    const id = setInterval(tick, 50);
    // Only need to track during crown removal (first 5000ms)
    const timeout = setTimeout(() => clearInterval(id), 5500);
    return () => { clearInterval(id); clearTimeout(timeout); };
  }, [pmRoulette?.ceremonyId, pmRoulette?.startedAt]);

  const isInCrownRemoval = pmRoulette && crownRemovalElapsed < 5000;
  const crownLifted = crownRemovalElapsed >= 2500; // crown lift starts at 2500ms
  const leaderWalkOff = crownRemovalElapsed >= 3000; // leader walks off at 3000ms

  // Render a single player box (or a frozen "leaving" copy) — keeps the grid + leaving layer DRY.
  // `id` is the stable Firebase key (session ID); `data.name` is the display name.
  // `currentPlayer` is the current viewer's ID so "me" highlighting is exact even
  // when two viewers share a display name.
  const renderPlayer = (id, data, opts = {}) => {
    const { className = '', style = {}, keySuffix = '', walking = false, testIdOverride, isSyntheticLeader = false } = opts;
    const displayName = data.name || id;
    const isMe = id === currentPlayer;
    const isSpeaking = !isSyntheticLeader && activeQuote && activeQuote.name === displayName;
    const justArrived = recentArrivals.has(id);
    const nameTagClass = justArrived ? 'name-tag-arrived' : '';
    const testId = testIdOverride ?? `player-${displayName}`;

    // Crown controlled by the centralized useCrownOwnership hook.
    // A player shows a crown only when crownOwnership says the crown is
    // on 'player-head' for THIS player's id. Synthetic leader during
    // Act 1 retains crown until the hook transitions it away (rule 1).
    const showCrown = crownOwnership
      ? crownOwnership.location === 'player-head' && crownOwnership.playerId === id
        && !keySuffix?.includes('leaving')  // walk-off copies never show crown
      : false;

    // v3: non-match reel player wipe-brow relief during near-miss hold
    const isNonMatchRelief = !isSyntheticLeader
      && phaseState?.nonMatchRelief
      && phaseState.nonMatchReliefPlayerId === id;
    const fukEyes = !isSyntheticLeader && (fukEyesSet.has(displayName) || isNonMatchRelief);

    const figureSlot = walking
      ? <WalkingFigure name={displayName} fukEyes={fukEyes} showCrown={showCrown} />
      : <PlayerFigure name={displayName} holdingCard={false} fukEyes={fukEyes} showCrown={showCrown} />;

    if (splitMode) {
      const hasVotedFe = data.voteFe != null;
      const hasVotedBe = data.voteBe != null;

      return (
        <div
          key={id + keySuffix}
          className={className}
          style={{ ...styles.player, ...style }}
          data-testid={testId}
          data-player-id={id}
        >
          {!isSyntheticLeader && (
            <div style={styles.splitCardRow}>
              <div style={styles.splitSlot}>
                <div style={styles.splitLabel}>FE</div>
                {hasVotedFe ? (
                  <div style={{
                    ...styles.splitCard,
                    ...(phase === 'revealed' ? styles.cardRevealed : styles.cardHiddenFe),
                  }}>
                    {phase === 'revealed' ? data.voteFe : '?'}
                  </div>
                ) : (
                  <div style={styles.splitCardEmpty} />
                )}
              </div>
              <div style={styles.splitSlot}>
                <div style={styles.splitLabel}>BE</div>
                {hasVotedBe ? (
                  <div style={{
                    ...styles.splitCard,
                    ...(phase === 'revealed' ? styles.cardRevealed : styles.cardHiddenBe),
                  }}>
                    {phase === 'revealed' ? data.voteBe : '?'}
                  </div>
                ) : (
                  <div style={styles.splitCardEmpty} />
                )}
              </div>
            </div>
          )}

          <div style={{ position: 'relative' }}>
            {figureSlot}
            {isSpeaking && <div style={styles.devBubble}>{activeQuote.text}</div>}
          </div>

          <div
            data-player-tag
            className={nameTagClass}
            style={{ ...styles.nameTag, ...(isMe ? styles.nameTagMe : {}), maxWidth: 160, position: 'relative' }}
          >
            {data.isLeader ? '👑 ' : ''}{displayName}
          </div>
        </div>
      );
    }

    // Normal single-card mode
    const hasVoted = data.vote != null;

    return (
      <div
        key={id + keySuffix}
        className={className}
        style={{ ...styles.player, ...style }}
        data-testid={testId}
        data-player-id={id}
      >
        {!isSyntheticLeader && (
          <div style={styles.cardSlot}>
            {hasVoted && (
              <div style={{
                ...styles.card,
                ...(phase === 'revealed' ? styles.cardRevealed : styles.cardHidden),
              }}>
                {phase === 'revealed' ? data.vote : '?'}
              </div>
            )}
          </div>
        )}

        <div style={{ position: 'relative' }}>
          {figureSlot}
          {isSpeaking && <div style={styles.devBubble}>{activeQuote.text}</div>}
        </div>

        <div
          className={nameTagClass}
          data-player-tag
          style={{ ...styles.nameTag, ...(isMe ? styles.nameTagMe : {}), maxWidth: 160, position: 'relative' }}
        >
          {data.isLeader ? '👑 ' : ''}{displayName}
        </div>
      </div>
    );
  };

  // Callback for the cinematic component: the moment its handoff animation
  // parks the figure on its grid slot, it calls this so we can flip the
  // placeholder into the real (visible) figure on this client without any
  // Firebase roundtrip. Runs on EVERY client (not just the leader), so
  // non-leaders don't see a flicker either.
  const handlePlayerExit = () => {
    const hiddenId = activeEntrance?.event.getHiddenPlayer?.(activeEntrance.payload);
    if (hiddenId) markArrived(hiddenId);
  };

  return (
    <div style={styles.container}>
      {/* Whatever entrance event is currently active — driven entirely by
          Firebase syncedEvent, no local mirror state. Adding a new entrance
          type requires ZERO changes here — just drop it in the registry. */}
      <EntranceStage activeEntrance={activeEntrance} onPlayerExit={handlePlayerExit} />

      <div style={styles.grid}>
        {/* iter 4: Leader figure retention during Act 1 (crownRemoval).
            When the outgoing leader's Firebase node is gone but we're in
            crownRemoval phase, render a synthetic entry from the payload's
            snapshot. Figure stays at full opacity until crown is taken,
            then walks off. No rendering during Acts 2+3 (ghost eliminated). */}
        {outgoingId && outgoingData && outgoingData.role !== 'pm'
          && isInCrownRemoval
          && !playerEntries.some(([id]) => id === outgoingId)
          && renderPlayer(outgoingId, { ...outgoingData, isLeader: !leaderWalkOff }, {
            keySuffix: '__synthetic-leader',
            isSyntheticLeader: true,
            testIdOverride: `player-${outgoingData.name}-outgoing`,
            // Trigger walk-off animation once PM takes crown.
            // Use a fixed 0.6s duration (not the variable hashDir duration) so
            // the leader is guaranteed to be gone before the cabinet drops at
            // t=2500ms. The walk-off starts at t=1500ms, 600ms fits cleanly
            // within the 800ms window (1500-2300ms) before the silence gap.
            className: leaderWalkOff ? `player-walk-out-${hashDir(outgoingData.name || '').dir === 'left' ? 'right' : 'left'}` : '',
            style: leaderWalkOff ? { '--enter-duration': '0.6s' } : {},
            walking: !!leaderWalkOff,
          })
        }
        {playerEntries.map(([id, data]) => {
          const displayName = data.name || id;
          // Engine tells us which players are currently being rendered by
          // a cinematic entrance; reserve their grid slot with a
          // visibility: hidden copy of the real figure so the cinematic
          // animation has a deterministic target to aim at (and flexbox
          // holds the exact pixel-identical box).
          if (hiddenPlayers.has(id)) {
            // Reserve the grid slot with an invisible copy of the real
            // figure so the cinematic animation has a deterministic
            // target to aim at. Flexbox reserves the same pixel box as
            // the real entry. Testid is suffixed `-placeholder` so
            // queryByTestId('player-{name}') still returns null while
            // the cinematic is playing.
            return (
              <div
                key={id}
                style={{
                  visibility: 'hidden',
                  minHeight: 100,
                  display: 'flex',
                }}
                data-entrance-target={id}
              >
                {renderPlayer(id, data, {
                  keySuffix: '__placeholder',
                  testIdOverride: `player-${displayName}-placeholder`,
                })}
              </div>
            );
          }

          const enterInfo = enteringPlayers[id];
          const className = enterInfo ? `player-walk-in-${enterInfo.dir}` : '';
          const style = enterInfo ? { '--enter-duration': `${enterInfo.duration}s` } : {};
          return renderPlayer(id, data, { className, style, walking: !!enterInfo });
        })}

        {/* Leaving players — frozen last-known figure walks off-screen */}
        {Object.entries(leavingPlayers).map(([id, { info, data }]) => {
          const className = `player-walk-out-${info.dir}`;
          const style = { '--enter-duration': `${info.duration}s` };
          return renderPlayer(id, data, { className, style, keySuffix: '__leaving', walking: true });
        })}
      </div>
    </div>
  );
}

const cardBase = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '0',
  fontFamily: pixel,
  fontWeight: 'bold',
};

const devBubbleStyle = {
  position: 'absolute',
  bottom: '100%',
  left: '50%',
  transform: 'translateX(-50%)',
  background: '#fff',
  border: '2px solid #3498db',
  borderRadius: '6px',
  padding: '4px 8px',
  fontSize: '0.45rem',
  fontFamily: pixel,
  color: '#2a2a3a',
  whiteSpace: 'normal',
  maxWidth: '180px',
  textAlign: 'center',
  lineHeight: '1.5',
  boxShadow: '2px 2px 0 #2074a8',
  zIndex: 10,
  marginBottom: '4px',
};

const hiddenPattern = {
  background: `
    linear-gradient(45deg, #d4a853 25%, transparent 25%),
    linear-gradient(-45deg, #d4a853 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #d4a853 75%),
    linear-gradient(-45deg, transparent 75%, #d4a853 75%)
  `,
  backgroundSize: '8px 8px',
  backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0px',
  color: 'transparent',
};

const styles = {
  container: {
    padding: '1.5rem 1rem',
  },
  grid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '16px 28px',
    justifyContent: 'center',
  },
  player: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    width: 80,
  },
  // Single card mode
  cardSlot: {
    width: '56px',
    height: '80px',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginBottom: '4px',
  },
  card: {
    ...cardBase,
    width: '52px',
    height: '72px',
    fontSize: '1rem',
  },
  cardHidden: {
    ...hiddenPattern,
    backgroundColor: '#2c3e6b',
    border: '3px solid #d4a853',
    boxShadow: '2px 2px 0 #1a2540',
  },
  cardRevealed: {
    background: '#f5f0e4',
    border: '3px solid #d4a853',
    color: '#2a2a3a',
    boxShadow: '2px 2px 0 #b8922e',
  },
  // Split card mode
  splitCardRow: {
    display: 'flex',
    gap: '4px',
    marginBottom: '4px',
  },
  splitSlot: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '2px',
  },
  splitLabel: {
    fontSize: '0.35rem',
    fontFamily: pixel,
    color: '#888',
  },
  splitCard: {
    ...cardBase,
    width: '36px',
    height: '50px',
    fontSize: '0.75rem',
  },
  splitCardEmpty: {
    width: '36px',
    height: '50px',
  },
  cardHiddenFe: {
    ...hiddenPattern,
    backgroundColor: '#2c5a8b',
    border: '3px solid #3498db',
    boxShadow: '2px 2px 0 #1a3a5a',
  },
  cardHiddenBe: {
    ...hiddenPattern,
    backgroundColor: '#2c6b3e',
    border: '3px solid #27ae60',
    boxShadow: '2px 2px 0 #1a4028',
  },
  nameTag: {
    padding: '2px 6px',
    fontSize: '0.6rem',
    fontFamily: pixel,
    border: '2px solid #d4a853',
    borderRadius: '0',
    background: '#f5f0e4',
    color: '#2a2a3a',
    maxWidth: '100px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  nameTagMe: {
    background: '#d4a853',
    color: '#2a2a3a',
  },
  // iter 2: crownBadge removed (gamification dropped, crownCount no longer displayed)
  devBubble: devBubbleStyle,
};
