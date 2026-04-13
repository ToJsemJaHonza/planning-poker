import ShameText from './ShameText';

/**
 * Orchestrates all shame overlay effects: vignette, floating text, screen shake.
 * Rendered in Room.jsx above the player list.
 */
export default function ShameOverlay({ stage, holdoutName, isHoldout, elapsed }) {
  if (stage < 1) return null;

  // Vignette: stage 3+ for holdout only
  const showVignette = isHoldout && stage >= 3;
  const vignetteOpacity = stage >= 5 ? 0.25 : stage >= 4 ? 0.15 : 0.08;

  return (
    <>
      {/* Floating shame text */}
      <ShameText stage={stage} holdoutName={holdoutName} isHoldout={isHoldout} />

      {/* Vignette overlay — holdout only */}
      {showVignette && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            pointerEvents: 'none',
            zIndex: 45,
            boxShadow: `inset 0 0 120px 40px rgba(255, ${stage >= 5 ? 30 : stage >= 4 ? 50 : 100}, ${stage >= 5 ? 15 : stage >= 4 ? 30 : 50}, ${vignetteOpacity})`,
            animation: stage >= 4 ? `stressMeterPulse 1500ms ease-in-out infinite` : 'none',
            transition: 'box-shadow 400ms ease',
          }}
        />
      )}
    </>
  );
}
