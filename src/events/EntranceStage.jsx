/**
 * Renders whatever entrance event is currently active.
 *
 * This component knows nothing about trains, pipelines, or any specific
 * animation — it just looks up the registered Component in the event
 * entry and mounts it with the Firebase payload as props. Adding a new
 * entrance type requires ZERO changes here.
 *
 * It also forwards an `onPlayerExit` callback and the shared
 * `entranceDirector` to the cinematic component. The cinematic doesn't
 * render its own figure anymore — at the "exit" beat in its timeline it
 * asks the director to teleport the player's persistent character to the
 * entrance door and walk it to the grid slot. Zero DOM swap, zero flicker.
 */
export default function EntranceStage({ activeEntrance, onPlayerExit, entranceDirector }) {
  if (!activeEntrance) return null;
  const { event, payload } = activeEntrance;
  const Component = event.Component;
  if (!Component) return null;
  return (
    <Component
      {...payload}
      onPlayerExit={onPlayerExit}
      entranceDirector={entranceDirector}
    />
  );
}
