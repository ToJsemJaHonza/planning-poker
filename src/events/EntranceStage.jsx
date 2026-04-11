/**
 * Renders whatever entrance event is currently active.
 *
 * This component knows nothing about trains, pipelines, or any specific
 * animation — it just looks up the registered Component in the event
 * entry and mounts it with the Firebase payload as props. Adding a new
 * entrance type requires ZERO changes here.
 *
 * It also forwards an `onPlayerExit` callback to the cinematic component.
 * The component invokes that callback at the exact moment its
 * useCinematicHandoff arrives at the grid slot, which flips the hidden
 * placeholder into a visible figure on THIS client with no Firebase
 * roundtrip. Zero-latency handoff = zero flicker.
 */
export default function EntranceStage({ activeEntrance, onPlayerExit }) {
  if (!activeEntrance) return null;
  const { event, payload } = activeEntrance;
  const Component = event.Component;
  if (!Component) return null;
  return <Component {...payload} onPlayerExit={onPlayerExit} />;
}
