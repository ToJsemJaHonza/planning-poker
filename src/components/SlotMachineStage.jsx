import SlotMachine from './SlotMachine';

/**
 * SlotMachineStage -- the root overlay for the PM crowning ceremony.
 *
 * 3-act ceremony: crownRemoval (Act 1) -> cabinet (Act 2) -> crownDelivery (Act 3).
 * Cabinet drops in during Act 2. "THE CROWN PASSES" overlay appears during Act 3.
 *
 * The PM walking across Acts 1 and 3 used to render here with its own
 * <PmSprite> wrapper; it is now part of the unified CharacterStage in
 * Room.jsx and animated by `usePmDirector`. The handoff jump that sat at
 * this mount point is gone.
 *
 * Pure renderer -- receives phaseState and crownOwnership as props.
 */
export default function SlotMachineStage({
  pmRoulette,
  players,
  phaseState,
}) {
  if (!pmRoulette) return null;
  if (phaseState.phase === 'idle' || phaseState.phase === 'done') return null;

  // === Cabinet phase (visible until cabinetOut ends) ========================
  const showCabinet = phaseState.cabinetTransform !== 'gone'
    && phaseState.cabinetTransform !== 'offscreen';

  return (
    <div style={styles.stage} data-cm-stage>
      {/* Backdrop dim layer */}
      <div
        style={{
          ...styles.backdrop,
          opacity: phaseState.dimLevel * 0.72,
        }}
      />

      {/* Sepia vignette tint over the grid */}
      <div
        style={{
          ...styles.sepiaTint,
          opacity: phaseState.dimLevel * 0.5,
        }}
      />

      {/* Cabinet — unmounts when gone */}
      {showCabinet && (
        <SlotMachine
          phaseState={phaseState}
          ceremony={pmRoulette}
          players={players}
        />
      )}

      {/* Act 3: Spotlight + "THE CROWN PASSES" announcement */}
      {phaseState.phase === 'crownDelivery' && (
        <>
          {phaseState.processionSpotlightPosition && (
            <div style={{
              position: 'absolute',
              inset: 0,
              background: `radial-gradient(circle 120px at ${
                phaseState.processionSpotlightPosition.x}px ${
                phaseState.processionSpotlightPosition.y}px,
                transparent 0%, rgba(30, 26, 20, 0.25) 100%)`,
              zIndex: 212,
              pointerEvents: 'none',
            }} />
          )}

          {phaseState.showProcessionAnnouncement && (
            <div style={styles.processionText} className="cm-procession-text">
              THE CROWN PASSES
            </div>
          )}
        </>
      )}

      {/* Ceremony PM is drawn by <CharacterStage /> via usePmDirector —
          no separate mount here. Keeps one DOM node for the PM across
          idle → Act 1 → Act 2 → Act 3 → idle, so there is no pixel
          discontinuity at any phase boundary. */}
    </div>
  );
}

const styles = {
  stage: {
    position: 'fixed',
    inset: 0,
    zIndex: 205,
    pointerEvents: 'none',
    overflow: 'hidden',
  },
  backdrop: {
    position: 'absolute',
    inset: 0,
    background: 'rgba(30, 26, 20, 1)',
    transition: 'opacity 400ms ease-out',
  },
  sepiaTint: {
    position: 'absolute',
    inset: 0,
    background: '#2c1a0a',
    mixBlendMode: 'multiply',
    transition: 'opacity 400ms ease-out',
  },
  processionText: {
    position: 'absolute',
    top: '30%',
    left: '50%',
    transform: 'translateX(-50%)',
    fontSize: '1.1rem',
    fontFamily: "'Press Start 2P', monospace",
    color: '#f5c542',
    letterSpacing: 6,
    textShadow: '0 0 4px #f5c542, 0 0 8px #d4a853, 0 0 16px rgba(245,197,66,0.4), 2px 2px 0 #0a0b11',
    zIndex: 214,
    pointerEvents: 'none',
    whiteSpace: 'nowrap',
  },
};
