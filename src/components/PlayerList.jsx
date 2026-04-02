import PlayerFigure from './PlayerFigure';

const pixel = "'Press Start 2P', monospace";

export default function PlayerList({ players, phase, currentPlayer, splitMode }) {
  // Filter out PM (role='pm') — they don't get a figure
  const playerEntries = Object.entries(players)
    .filter(([_, data]) => data.role !== 'pm')
    .sort((a, b) => a[1].joinedAt - b[1].joinedAt);

  return (
    <div style={styles.container}>
      <div style={styles.grid}>
        {playerEntries.map(([name, data]) => {
          const isMe = name === currentPlayer;

          if (splitMode) {
            const hasVotedFe = data.voteFe != null;
            const hasVotedBe = data.voteBe != null;
            const hasVoted = hasVotedFe || hasVotedBe;

            return (
              <div key={name} style={styles.player}>
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

                <PlayerFigure name={name} holdingCard={false} />

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
            <div key={name} style={styles.player}>
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

              <PlayerFigure name={name} holdingCard={false} />

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
};
