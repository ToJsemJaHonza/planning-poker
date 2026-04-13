import SlotMachine from './SlotMachine';
import PmSprite from './PmSprite';

/**
 * SlotMachineStage -- the root overlay for the PM crowning ceremony.
 *
 * 3-act ceremony: crownRemoval (Act 1) -> cabinet (Act 2) -> crownDelivery (Act 3).
 * PM walks into the player grid during Acts 1 and 3. The slot machine cabinet
 * drops in during Act 2. "THE CROWN PASSES" overlay appears during Act 3.
 *
 * Pure renderer -- receives phaseState and crownOwnership as props.
 */
export default function SlotMachineStage({
  pmRoulette,
  players,
  phaseState,
  crownOwnership,
}) {
  if (!pmRoulette) return null;
  if (phaseState.phase === 'idle' || phaseState.phase === 'done') return null;

  // === Cabinet phase (visible until cabinetOut ends) ========================
  const showCabinet = phaseState.cabinetTransform !== 'gone'
    && phaseState.cabinetTransform !== 'offscreen';

  // === Ceremony PM (Acts 1 and 3) ======================================
  const showCeremonyPm = phaseState.pmMode === 'ceremony';
  const pmPos = phaseState.pmCeremonyPosition;
  const pmPose = phaseState.pmCeremonyPose || 'walk1';
  const pmBubble = phaseState.pmCeremonyBubble;
  const pmFacing = phaseState.pmCeremonyFacing;

  // Crown rendering driven by centralized crownOwnership.
  // The PM shows a crown when the ownership location is one of the
  // pm-controlled states (pm-hand, lifting, arcing-to-player, materializing).
  const pmCrownLocations = new Set(['pm-hand', 'lifting', 'arcing-to-player', 'materializing']);
  const showCrownInHand = showCeremonyPm && pmCrownLocations.has(crownOwnership.location);

  // Map crownOwnership location to PmSprite.jsx crownState prop format
  let pmCrownState = null;
  if (showCrownInHand) {
    if (crownOwnership.location === 'lifting') {
      pmCrownState = { mode: 'lifting', progress: crownOwnership.progress };
    } else if (crownOwnership.location === 'pm-hand') {
      pmCrownState = { mode: 'inHand', progress: 1 };
    } else if (crownOwnership.location === 'arcing-to-player') {
      pmCrownState = { mode: 'arcing', progress: crownOwnership.progress };
    } else if (crownOwnership.location === 'materializing') {
      pmCrownState = { mode: 'materializing', progress: crownOwnership.progress };
    }
  }
  const crownGlowing = crownOwnership.glowing;

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

      {/* Ceremony PM (Acts 1+3 and cabinetOut overlap) */}
      {showCeremonyPm && pmPos && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            // Explicit dimensions matching the PM sprite (12*5=60 x 14*5=70)
            // so the speech bubble can position relative to a real-sized container.
            // Without these, the container is 0x0 and wordBreak:break-word wraps
            // every character onto its own line (vertical text bug).
            width: 60,
            height: 70,
            // GPU-composited transform instead of left/top for smoother animation.
            // The -50% offsets center the sprite on the computed position.
            transform: `translate(${pmPos.x - 30}px, ${pmPos.y - 35}px)`,
            zIndex: 213,
            pointerEvents: 'none',
            willChange: 'transform',
            // Short transition smooths out frame drops without rubber-banding.
            // At 50ms linear, any React render batch that skips 1-2 frames
            // interpolates instead of jumping.
            transition: 'transform 50ms linear',
          }}
          data-cm-pm-ceremony
        >
          <PmSprite
            mode="ceremony"
            pmPose={pmPose}
            pmBubble={pmBubble?.text || ''}
            crownState={pmCrownState}
            crownGlowing={crownGlowing}
            ceremonyFacing={pmFacing}
          />
        </div>
      )}

      {/* Crown rendering is fully controlled by crownOwnership — no
          transition crown needed. The hook handles the settled->player-head
          handoff in a single render tick. */}
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
