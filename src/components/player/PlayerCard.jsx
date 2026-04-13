import PlayerFigure from '../PlayerFigure';
import WalkingFigure from './WalkingFigure';
import { SingleCard, SplitCards } from './VotingCards';
import StressMeter from '../shame/StressMeter';
import { pixel } from '../room/styles';

/**
 * A single player entry in the grid — figure, card(s), name tag, speech bubble.
 * Extracted from PlayerList.renderPlayer to keep the grid logic separate from
 * individual player rendering.
 */
export default function PlayerCard({
  id, data, currentPlayer, phase, splitMode,
  activeQuote, fukEyes, showCrown, walking,
  isSyntheticLeader, justArrived, playerIndex = 0,
  allVoted = false, stressStage = 0, shameStartedAt = 0,
  className = '', style = {}, keySuffix = '', testIdOverride,
}) {
  const displayName = data.name || id;
  const isMe = id === currentPlayer;
  const isSpeaking = !isSyntheticLeader && activeQuote && activeQuote.name === displayName;
  const nameTagClass = justArrived ? 'name-tag-arrived' : '';
  const testId = testIdOverride ?? `player-${displayName}`;

  const figureSlot = walking
    ? <WalkingFigure name={displayName} fukEyes={fukEyes} showCrown={showCrown} />
    : <PlayerFigure name={displayName} holdingCard={false} fukEyes={fukEyes} showCrown={showCrown} stressStage={stressStage} />;

  return (
    <div
      key={id + keySuffix}
      className={className}
      style={{ ...styles.player, ...style }}
      data-testid={testId}
      data-player-id={id}
    >
      {/* Voting cards — only for real players, not synthetic leader */}
      {!isSyntheticLeader && (
        splitMode
          ? <SplitCards data={data} phase={phase} playerIndex={playerIndex} />
          : <SingleCard data={data} phase={phase} playerIndex={playerIndex} />
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

      {/* Stress meter for shame holdout */}
      {stressStage >= 2 && <StressMeter stage={stressStage} startedAt={shameStartedAt} />}
    </div>
  );
}

const styles = {
  player: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    width: 80,
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
  devBubble: {
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
  },
};
