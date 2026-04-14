import { activeOverlays } from './entranceEvents';

/**
 * Renders every overlay-category cinematic that is currently active.
 *
 * The three full-screen overlays in the app (chicken, OKTA sheep,
 * SPECIAL ROUND splash) all have different trigger sources but otherwise
 * share the same lifecycle: a Firebase signal goes true for N ms, the
 * component mounts, the signal flips back, the component unmounts.
 *
 * `<OverlayStage>` walks the registry, reads the current trigger sources,
 * and mounts whichever Components are active. Adding a new overlay is a
 * one-line entry in `entranceEvents.js` — Room.jsx never has to change.
 *
 * Multiple overlays can render at once (a chicken running across the
 * SPECIAL ROUND splash is a feature, not a bug).
 */
export default function OverlayStage({ syncedEvent }) {
  const overlays = activeOverlays({ syncedEvent });
  if (overlays.length === 0) return null;
  return (
    <>
      {overlays.map(({ event, payload }) => {
        const Component = event.Component;
        if (!Component) return null;
        return <Component key={event.type} {...payload} />;
      })}
    </>
  );
}
