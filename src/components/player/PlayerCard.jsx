import { SingleCard, SplitCards } from './VotingCards';
import StressMeter from '../shame/StressMeter';
import { pixel } from '../room/styles';
import { SPRITE_W, SPRITE_H } from '../../engine/characterLayout';

/**
 * A single player entry in the grid — figure, card(s), name tag, speech
 * bubble.
 *
 * As of the JS-first motion refactor, every conditional decision has
 * already been baked into a `PlayerModel` by `usePlayerModels` upstream,
 * so this component just paints the model and never branches on parent
 * state.
 *
 * Two call shapes are supported during the migration:
 *   <PlayerCard model={model} />
 *   <PlayerCard {...legacyProps} />        // pre-refactor sites
 * The legacy form normalises into the same model shape internally.
 */
export default function PlayerCard(props) {
  const model = props.model ?? legacyPropsToModel(props);

  const {
    id,
    data,
    displayName,
    isMe,
    isSyntheticLeader,
    isPlaceholder,
    walking,
    fukEyes,
    showCrown,
    justArrived,
    stressStage,
    shameStartedAt,
    isSpeaking,
    speakingText,
    className = '',
    style = {},
    keySuffix = '',
    testIdOverride,
    playerIndex = 0,
    phase,
    splitMode,
  } = model;


  const nameTagClass = justArrived ? 'name-tag-arrived' : '';
  const testId = testIdOverride ?? `player-${displayName}`;

  // Figure rendering moved to the unified CharacterStage in Room.jsx —
  // the grid card only reserves an invisible slot so card chrome
  // (voting cards above, name tag below) keeps its flex layout. We
  // reserve 100 px of height instead of just SPRITE_H (70 px) so the
  // sprite has visual clearance from the voting card above and the
  // name tag below; otherwise the sprite ends up tight against the
  // name tag. The stage character's y is `computePlayerGridPosition`'s
  // FIGURE_OFFSET_FROM_TOP, which matches this slot's center.
  const figureSlot = (
    <div
      aria-hidden="true"
      data-figure-placeholder={id}
      style={{ width: SPRITE_W, height: 120 }}
    />
  );
  // `walking`, `fukEyes`, `showCrown`, `stressStage` are now character
  // properties — dereferenced here only to acknowledge the legacy prop
  // surface; the character stage owns the actual rendering.
  void walking; void fukEyes; void showCrown; void stressStage;

  const cardContent = (
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
        {isSpeaking && <div style={styles.devBubble}>{speakingText}</div>}
      </div>

      <div
        className={nameTagClass}
        data-player-tag
        style={{ ...styles.nameTag, ...(isMe ? styles.nameTagMe : {}), maxWidth: 160, position: 'relative' }}
      >
        {data?.isLeader ? '👑 ' : ''}{displayName}
      </div>

      {/* Stress meter for shame holdout */}
      {stressStage >= 2 && <StressMeter stage={stressStage} startedAt={shameStartedAt} />}
    </div>
  );

  // Placeholder slot wraps the card in a hidden positioning anchor so the
  // EntranceStage handoff can measure where to walk a cinematic figure to.
  if (isPlaceholder) {
    return (
      <div
        key={id + keySuffix}
        style={{ visibility: 'hidden', minHeight: 100, display: 'flex' }}
        data-entrance-target={id}
      >
        {cardContent}
      </div>
    );
  }

  return cardContent;
}

/**
 * Bridge: pre-refactor call sites passed flat props instead of a model.
 * We keep them working by normalising to the shared shape so PlayerCard
 * never has to know which call style it received.
 */
function legacyPropsToModel(props) {
  const {
    id, data, currentPlayer, phase, splitMode,
    activeQuote, fukEyes, showCrown, walking,
    isSyntheticLeader, justArrived, playerIndex = 0,
    allVoted = false, stressStage = 0, shameStartedAt = 0,
    className = '', style = {}, keySuffix = '', testIdOverride,
  } = props;
  const displayName = data?.name || id;
  const isSpeaking = !isSyntheticLeader && !!activeQuote && activeQuote.name === displayName;
  return {
    id,
    data,
    displayName,
    isMe: id === currentPlayer,
    isSyntheticLeader: !!isSyntheticLeader,
    isPlaceholder: false,
    walking: !!walking,
    fukEyes: !!fukEyes,
    showCrown: !!showCrown,
    justArrived: !!justArrived,
    stressStage,
    shameStartedAt,
    isSpeaking,
    speakingText: isSpeaking ? activeQuote.text : '',
    doNod: !!allVoted,
    className,
    style,
    keySuffix,
    testIdOverride,
    playerIndex,
    phase,
    splitMode,
  };
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
    // Extra clearance from the stage-rendered figure above — without it
    // the name sits right under the sprite's feet and looks cramped.
    marginTop: '12px',
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
