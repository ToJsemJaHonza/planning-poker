import PlayerFigure from '../PlayerFigure';
import { WALK_FRAME_MS } from '../../engine/animation';
import { useFrameToggle } from '../../engine/useFrameTicker';

/**
 * A player figure that animates its legs — toggles between two walk-cycle
 * sprite frames. Must be a module-scope component (not defined inside
 * PlayerList) so React doesn't unmount/remount on parent re-renders.
 *
 * Frame toggling rides MotionRuntime's shared rAF (via useFrameToggle) so
 * the legs stay synced with every other animated element on screen and
 * pause cleanly when the tab is hidden.
 */
export default function WalkingFigure({ name, fukEyes, showCrown }) {
  const frame = useFrameToggle(WALK_FRAME_MS);
  return <PlayerFigure name={name} holdingCard={false} fukEyes={fukEyes} walkFrame={frame} showCrown={showCrown} />;
}
