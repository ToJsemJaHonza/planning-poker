/**
 * useWizardPosition - unified JS-driven wizard positioning.
 *
 * Replaces the dual CSS-keyframe / JS-position system with a single source
 * of truth for the wizard's { x, y, facingLeft } coordinates.
 *
 * In "idle" mode, uses requestAnimationFrame to ping-pong the wizard between
 * x=10 and x=viewportWidth-70 over 16 seconds (matching the old CSS
 * animation timing from @keyframes wizard-path).
 *
 * When a ceremony starts, freezes the current idle position and returns it
 * as the ceremony start position. When the ceremony ends, resumes idle walk
 * from the current position.
 *
 * This eliminates:
 *   - The CSS/JS handoff jump (Bug 1: PM walks down)
 *   - The getBoundingClientRect read (Bug 2: jumps on non-leader)
 *   - The CSS scaleX(-1) that mirrored text (Bug 4: mirrored text)
 */

import { useState, useRef, useEffect } from 'react';

// Desktop bottom: 105px from bottom, Mobile: 165px from bottom.
// These match the old CSS values from wizard.css and responsive.css.
const DESKTOP_BOTTOM = 105;
const MOBILE_BOTTOM = 165;
const MOBILE_BREAKPOINT = 560;

// Idle walk: 16s full cycle (8s each direction), matching the old CSS animation.
const CYCLE_MS = 16000;

function getBottomPx() {
  if (typeof window === 'undefined') return DESKTOP_BOTTOM;
  return window.innerWidth <= MOBILE_BREAKPOINT ? MOBILE_BOTTOM : DESKTOP_BOTTOM;
}

function getViewportWidth() {
  if (typeof window === 'undefined') return 1440;
  return window.innerWidth;
}

/**
 * Compute the idle walk position from a cycle-relative time.
 *
 * Mimics the old CSS keyframes:
 *   0%-3%:   hold at x=10 (facing right)
 *   3%-47%:  move right to viewportWidth-70
 *   47%-50%: hold at right edge, flip to face left
 *   50%-53%: hold at right edge (facing left)
 *   53%-97%: move left to x=10
 *   97%-100%: hold at left edge, flip to face right
 */
function computeIdlePosition(cycleTime, vw) {
  const minX = 10;
  const maxX = vw - 70;
  const range = maxX - minX;

  // Normalize to 0..1 within the full cycle
  const t = (cycleTime % CYCLE_MS) / CYCLE_MS;

  if (t < 0.03) {
    // 0%-3%: hold at left, facing right
    return { x: minX, facingLeft: false };
  } else if (t < 0.47) {
    // 3%-47%: move right
    const progress = (t - 0.03) / (0.47 - 0.03);
    return { x: minX + range * progress, facingLeft: false };
  } else if (t < 0.50) {
    // 47%-50%: hold at right edge (transition zone)
    return { x: maxX, facingLeft: false };
  } else if (t < 0.53) {
    // 50%-53%: hold at right edge, now facing left
    return { x: maxX, facingLeft: true };
  } else if (t < 0.97) {
    // 53%-97%: move left
    const progress = (t - 0.53) / (0.97 - 0.53);
    return { x: maxX - range * progress, facingLeft: true };
  } else {
    // 97%-100%: hold at left edge (transition back to right)
    return { x: minX, facingLeft: true };
  }
}

/**
 * @param {object} opts
 * @param {boolean} opts.ceremonyActive - true when a ceremony (pmRoulette or roomStartCrowning) is active
 * @returns {{ x: number, y: number, facingLeft: boolean, startPos: { x: number, y: number } | null }}
 *   - x, y, facingLeft: current wizard position and direction
 *   - startPos: snapshot of position when ceremony started (for ceremony use)
 */
export function useWizardPosition({ ceremonyActive }) {
  // Cycle origin: the absolute time corresponding to cycleTime=0.
  // Persists across idle/ceremony transitions.
  const cycleOriginRef = useRef(Date.now());

  // Latest computed idle position (updated every rAF frame).
  const [position, setPosition] = useState(() => {
    const vw = getViewportWidth();
    const bottomPx = getBottomPx();
    const pos = computeIdlePosition(0, vw);
    return {
      x: pos.x,
      y: (typeof window !== 'undefined' ? window.innerHeight : 900) - bottomPx,
      facingLeft: pos.facingLeft,
    };
  });

  // Ceremony start position snapshot
  const startPosRef = useRef(null);
  const wasActiveRef = useRef(false);

  // When ceremony starts, snapshot current position and freeze the cycle.
  // When ceremony ends, resume from wherever we left off.
  useEffect(() => {
    if (ceremonyActive && !wasActiveRef.current) {
      // Ceremony just started: snapshot the current idle position
      startPosRef.current = { x: position.x, y: position.y };
    }
    if (!ceremonyActive && wasActiveRef.current) {
      // Ceremony just ended: resume the cycle from the current position.
      // We find which cycle time corresponds to the current x and reset
      // the origin so the walk continues smoothly from here.
      const vw = getViewportWidth();
      const minX = 10;
      const maxX = vw - 70;
      const range = maxX - minX;
      const clampedX = Math.max(minX, Math.min(maxX, position.x));
      const fraction = range > 0 ? (clampedX - minX) / range : 0;

      // Place the wizard at the matching position in the cycle
      let cycleT;
      if (position.facingLeft) {
        // Moving left: 53%-97% range
        cycleT = 0.53 + (1 - fraction) * (0.97 - 0.53);
      } else {
        // Moving right: 3%-47% range
        cycleT = 0.03 + fraction * (0.47 - 0.03);
      }
      cycleOriginRef.current = Date.now() - cycleT * CYCLE_MS;
      startPosRef.current = null;
    }
    wasActiveRef.current = ceremonyActive;
  }, [ceremonyActive]);

  // rAF loop for idle walk
  const rafRef = useRef(null);

  useEffect(() => {
    if (ceremonyActive) {
      // Don't run the idle walk during ceremonies
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    const tick = () => {
      const now = Date.now();
      const cycleTime = now - cycleOriginRef.current;
      const vw = getViewportWidth();
      const vh = typeof window !== 'undefined' ? window.innerHeight : 900;
      const bottomPx = getBottomPx();
      const pos = computeIdlePosition(cycleTime, vw);

      setPosition(prev => {
        const nextX = Math.round(pos.x);
        const nextY = vh - bottomPx;
        if (prev.x === nextX && prev.y === nextY && prev.facingLeft === pos.facingLeft) {
          return prev; // avoid re-render if nothing changed
        }
        return { x: nextX, y: nextY, facingLeft: pos.facingLeft };
      });

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [ceremonyActive]);

  // Handle window resize: update bottom position
  useEffect(() => {
    const handleResize = () => {
      // The rAF loop will pick up the new viewport dimensions on next tick.
      // But if we're in ceremony mode, update the y position immediately.
      if (ceremonyActive) {
        const vh = window.innerHeight;
        const bottomPx = getBottomPx();
        setPosition(prev => ({ ...prev, y: vh - bottomPx }));
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [ceremonyActive]);

  return {
    x: position.x,
    y: position.y,
    facingLeft: position.facingLeft,
    startPos: startPosRef.current,
  };
}

// Exported for tests
export { computeIdlePosition, CYCLE_MS, DESKTOP_BOTTOM, MOBILE_BOTTOM, MOBILE_BREAKPOINT };
