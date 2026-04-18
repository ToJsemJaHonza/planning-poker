import EntranceStage from '../events/EntranceStage';
import PlayerCard from './player/PlayerCard';
import { usePlayerModels } from '../hooks/usePlayerModels';
import { useEntranceDirector } from '../events/useEntranceDirector';

/**
 * Pure renderer for the player grid.
 *
 * All per-player state (entering, leaving, fukEyes, shame stress,
 * ambient quotes, synthetic outgoing leader) is normalised by
 * `usePlayerModels` into a single `PlayerModel` array. This component
 * just maps models → cards and never branches on raw inputs itself.
 *
 * The crown is NOT a per-player concern — it's rendered by <CrownStage>
 * at the Room level from the canonical `crownOwnership` object.
 */
export default function PlayerList({
  players, phase, currentPlayer, splitMode,
  syncedEvent, fireSyncedEvent, isLeader,
  createdAt = 0, pmRoulette = null, phaseState = null,
  shameTimer = null, shameStage = 0,
  allVoted = false, stage = null, roomCode = null,
}) {
  const {
    activePlayers,
    leavingPlayers,
    activeEntrance,
    handlePlayerExit,
    markArrived,
  } = usePlayerModels({
    players, currentPlayer, phase, splitMode,
    syncedEvent, fireSyncedEvent, isLeader, createdAt,
    pmRoulette, phaseState,
    shameTimer, shameStage, allVoted, stage, roomCode,
  });


  const entranceDirector = useEntranceDirector({
    stage,
    players,
    markArrived,
  });

  return (
    <div data-player-list style={styles.container}>
      <EntranceStage
        activeEntrance={activeEntrance}
        onPlayerExit={handlePlayerExit}
        entranceDirector={entranceDirector}
      />

      <div data-player-grid style={styles.grid}>
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
