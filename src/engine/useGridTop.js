/**
 * useGridTop — live measurement of the player-grid container's viewport y.
 *
 * The figure on `CharacterStage` is `position: fixed`, but the matching
 * card on `PlayerList` flows in the document under header / task / phase
 * bars whose heights vary per view (PM vs leader vs plain player) and per
 * room state (empty task vs grooming backlog). A hardcoded `GRID_TOP`
 * desynchronizes the two surfaces — so we measure the actual y of the
 * grid container at runtime and feed it through `computePlayerGridPosition`.
 *
 * Re-measures when:
 *   - the ref'd element resizes (entries gained/lost, wrap),
 *   - any ancestor reflow shifts our top (TaskBar empty↔list flips,
 *     PhaseBar gains/loses buttons, window resize).
 *
 * No new rAF loop: ResizeObserver is the one trigger and we coalesce
 * synchronous bursts via a single rAF flush. Returns `DEFAULT_GRID_TOP`
 * when window / ResizeObserver isn't available (jsdom, SSR).
 */

import { useEffect, useState } from 'react';
import { DEFAULT_GRID_TOP } from './gridPosition';

export function useGridTop(ref) {
  const [gridTop, setGridTop] = useState(DEFAULT_GRID_TOP);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const node = ref?.current;
    if (!node || typeof node.getBoundingClientRect !== 'function') {
      return undefined;
    }

    let raf = 0;
    let cancelled = false;

    const measure = () => {
      raf = 0;
      if (cancelled) return;
      const rect = node.getBoundingClientRect();
      // `top` can be 0 during very early layout passes; guard against
      // pushing the figure to viewport top by only accepting positive
      // values. A genuine zero would mean the grid is at the very top
      // of the viewport, which never happens (RoomHeader sits above it).
      if (rect.top > 0) setGridTop(rect.top);
    };

    const schedule = () => {
      if (raf) return;
      if (typeof window.requestAnimationFrame !== 'function') {
        measure();
        return;
      }
      raf = window.requestAnimationFrame(measure);
    };

    schedule();

    const onResize = () => schedule();
    window.addEventListener('resize', onResize);

    let elementRO = null;
    let bodyRO = null;
    if (typeof window.ResizeObserver === 'function') {
      elementRO = new window.ResizeObserver(schedule);
      elementRO.observe(node);
      // Bars *above* the grid resizing (TaskBar list mode toggling, chip
      // wrap on resize) don't change the grid's own size, but they do
      // shift its top. Watching body catches those reflows.
      if (document?.body) {
        bodyRO = new window.ResizeObserver(schedule);
        bodyRO.observe(document.body);
      }
    }

    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      elementRO?.disconnect();
      bodyRO?.disconnect();
    };
  }, [ref]);

  return gridTop;
}
