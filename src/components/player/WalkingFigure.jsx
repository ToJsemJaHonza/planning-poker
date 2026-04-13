import { useState, useEffect } from 'react';
import PlayerFigure from '../PlayerFigure';
import { WALK_FRAME_MS } from '../../engine/animation';

/**
 * A player figure that animates its legs — toggles between two walk-cycle
 * sprite frames. Must be a module-scope component (not defined inside
 * PlayerList) so React doesn't unmount/remount on parent re-renders.
 */
export default function WalkingFigure({ name, fukEyes, showCrown }) {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setFrame(f => f ^ 1), WALK_FRAME_MS);
    return () => clearInterval(id);
  }, []);
  return <PlayerFigure name={name} holdingCard={false} fukEyes={fukEyes} walkFrame={frame} showCrown={showCrown} />;
}
