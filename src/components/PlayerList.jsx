import { useRef, useState, useEffect } from 'react';
import PlayerFigure from './PlayerFigure';
import Train from './Train';

const pixel = "'Press Start 2P', monospace";

function isRichardName(name) {
  const clean = name.toLowerCase().replace(/\./g, '');
  return ['richard', 'ricardo', 'ricardino', 'ricardito', 'ricardinho'].includes(clean);
}

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

// Direction + speed based on name hash
const ENTER_DIRECTIONS = ['left', 'right'];

function hashDir(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = ((h << 5) - h + name.charCodeAt(i)) | 0;
  const abs = Math.abs(h);
  return {
    dir: ENTER_DIRECTIONS[abs % 2],
    duration: 1.2 + (abs % 10) * 0.15, // 1.2s to 2.55s — varying speed
  };
}

const FUKNAMES = ['františek', 'fanda'];

export default function PlayerList({ players, phase, currentPlayer, splitMode, syncedEvent, fireSyncedEvent, isLeader }) {
  const playerEntries = Object.entries(players)
    .filter(([_, data]) => data.role !== 'pm')
    .sort((a, b) => a[1].joinedAt - b[1].joinedAt);

  // Track known players to detect new joins
  const knownRef = useRef(new Set());
  const [enteringPlayers, setEnteringPlayers] = useState({});
  const trainTriggeredRef = useRef(new Set());

  useEffect(() => {
    const currentNames = playerEntries.map(([name]) => name);
    const newPlayers = {};

    let maxDuration = 0;
    for (const name of currentNames) {
      if (!knownRef.current.has(name)) {
        // Richard variants: 10% chance of train entrance — leader fires via Firebase
        if (isLeader && isRichardName(name) && Math.random() < 0.1 && !syncedEvent && !trainTriggeredRef.current.has(name)) {
          trainTriggeredRef.current.add(name);
          const fromRight = Math.random() > 0.5;
          fireSyncedEvent?.({ type: 'train', playerName: name, fromRight }, 12000);
        } else if (!isRichardName(name) || !syncedEvent || syncedEvent.type !== 'train' || syncedEvent.playerName !== name) {
          const info = hashDir(name);
          newPlayers[name] = info;
          if (info.duration > maxDuration) maxDuration = info.duration;
        }
      }
    }

    if (Object.keys(newPlayers).length > 0) {
      setEnteringPlayers(prev => ({ ...prev, ...newPlayers }));
      setTimeout(() => {
        setEnteringPlayers(prev => {
          const next = { ...prev };
          Object.keys(newPlayers).forEach(n => delete next[n]);
          return next;
        });
      }, (maxDuration + 0.2) * 1000);
    }

    knownRef.current = new Set(currentNames);
  }, [playerEntries.map(([n]) => n).join(',')]);

  // === ALL EVENTS SYNCED VIA FIREBASE (leader decides, all clients render) ===

  // Fuk eyes — leader decides on phase change, writes to Firebase
  const fukEyesSet = new Set(syncedEvent?.type === 'fukEyes' ? syncedEvent.names : []);
  useEffect(() => {
    if (!isLeader) return;
    const fuk = [];
    playerEntries.forEach(([name]) => {
      if (FUKNAMES.includes(name.toLowerCase()) && Math.random() < 0.1) {
        fuk.push(name);
      }
    });
    if (fuk.length > 0) {
      fireSyncedEvent?.({ type: 'fukEyes', names: fuk }, 60000); // lasts until next round
    }
  }, [phase, isLeader]);

  // Train — leader decides when Richard joins
  const trainFromEvent = syncedEvent?.type === 'train' ? syncedEvent : null;
  const [hiddenByTrain, setHiddenByTrain] = useState(new Set());

  useEffect(() => {
    if (trainFromEvent) {
      setHiddenByTrain(new Set([trainFromEvent.playerName]));
    }
  }, [trainFromEvent?.playerName]);

  const handleTrainPlayerExit = () => {
    if (!trainFromEvent) return;
    const name = trainFromEvent.playerName;
    setHiddenByTrain(new Set());
    const info = { dir: trainFromEvent.fromRight ? 'right' : 'left', duration: 1.5 };
    setEnteringPlayers(prev => ({ ...prev, [name]: info }));
    setTimeout(() => {
      setEnteringPlayers(prev => { const next = { ...prev }; delete next[name]; return next; });
    }, 1700);
  };

  // Alan coffee — leader fires on reveal
  useEffect(() => {
    if (!isLeader || phase !== 'revealed') return;
    playerEntries.forEach(([name, data]) => {
      if (name.toLowerCase() === 'alan' && data.vote === '☕' && Math.random() < 0.1) {
        setTimeout(() => {
          fireSyncedEvent?.({ type: 'devQuote', name, text: 'Fullstack FE developer' }, 4000);
        }, 1500);
      }
    });
  }, [phase, isLeader]);

  // Dev quotes — leader triggers, 2% chance every 3s
  const activeQuote = syncedEvent?.type === 'devQuote' ? syncedEvent : null;
  useEffect(() => {
    if (!isLeader) return;
    const names = playerEntries.map(([n]) => n);
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

  return (
    <div style={styles.container}>
      {/* Richard's train — synced via Firebase */}
      {trainFromEvent && (
        <Train
          fromRight={trainFromEvent.fromRight}
          onPlayerExit={handleTrainPlayerExit}
        />
      )}

      <div style={styles.grid}>
        {playerEntries.map(([name, data]) => {
          // Hide player during train sequence
          if (hiddenByTrain.has(name)) return null;

          const isMe = name === currentPlayer;
          const enterInfo = enteringPlayers[name];
          const enterClass = enterInfo ? `player-enter-${enterInfo.dir}` : '';
          const enterStyle = enterInfo ? { '--enter-duration': `${enterInfo.duration}s` } : {};
          const isSpeaking = activeQuote && activeQuote.name === name;

          if (splitMode) {
            const hasVotedFe = data.voteFe != null;
            const hasVotedBe = data.voteBe != null;
            const hasVoted = hasVotedFe || hasVotedBe;

            return (
              <div key={name} className={enterClass} style={{ ...styles.player, ...enterStyle }}>
                {/* Two cards side by side */}
                <div style={styles.splitCardRow}>
                  {/* FE card */}
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
                  {/* BE card */}
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

                <div style={{ position: 'relative' }}>
                  <PlayerFigure name={name} holdingCard={false} fukEyes={fukEyesSet.has(name)} />
                  {isSpeaking && <div style={styles.devBubble}>{activeQuote.text}</div>}
                </div>

                <div style={{
                  ...styles.nameTag,
                  ...(isMe ? styles.nameTagMe : {}),
                }}>
                  {data.isLeader ? '👑 ' : ''}{name}
                </div>
              </div>
            );
          }

          // Normal single-card mode
          const hasVoted = data.vote != null;

          return (
            <div key={name} className={enterClass} style={{ ...styles.player, ...enterStyle }}>
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

              <div style={{ position: 'relative' }}>
                <PlayerFigure name={name} holdingCard={false} fukEyes={fukEyesSet.has(name)} />
                {isSpeaking && <div style={styles.devBubble}>{activeQuote.text}</div>}
              </div>

              <div style={{
                ...styles.nameTag,
                ...(isMe ? styles.nameTagMe : {}),
              }}>
                {data.isLeader ? '👑 ' : ''}{name}
              </div>
            </div>
          );
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
  whiteSpace: 'nowrap',
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
  devBubble: devBubbleStyle,
};
