import EntranceStage from '../events/EntranceStage';
import PlayerCard from './player/PlayerCard';
import { usePlayerModels } from '../hooks/usePlayerModels';

/**
 * Pure renderer for the player grid.
 *
 * All per-player state (entering, leaving, fukEyes, showCrown, shame
 * stress, ambient quotes, synthetic outgoing leader) is normalised by
 * `usePlayerModels` into a single `PlayerModel` array. This component
 * just maps models → cards and never branches on raw inputs itself.
 */
export default function PlayerList({
  players, phase, currentPlayer, splitMode,
  syncedEvent, fireSyncedEvent, isLeader,
  createdAt = 0, pmRoulette = null, phaseState = null,
  crownOwnership = null, shameTimer = null, shameStage = 0,
  allVoted = false,
}) {
  const {
    activePlayers,
    leavingPlayers,
    outgoingLeader,
    activeEntrance,
    handlePlayerExit,
  } = usePlayerModels({
    players, currentPlayer, phase, splitMode,
    syncedEvent, fireSyncedEvent, isLeader, createdAt,
    pmRoulette, phaseState, crownOwnership,
    shameTimer, shameStage, allVoted,
  });


  return (
    <div data-player-list style={styles.container}>
      <EntranceStage activeEntrance={activeEntrance} onPlayerExit={handlePlayerExit} />

      <div data-player-grid style={styles.grid}>
        {outgoingLeader && (
          <PlayerCard
            key={outgoingLeader.id + outgoingLeader.keySuffix}
            model={outgoingLeader}
          />
        )}

        {activePlayers.map((m) => (
          <PlayerCard key={m.id + m.keySuffix} model={m} />
        ))}

        {leavingPlayers.map((m) => (
          <PlayerCard key={m.id + m.keySuffix} model={m} />
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
