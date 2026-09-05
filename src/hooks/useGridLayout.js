import { useLayoutEffect } from 'react';
import { SPRITE_H } from '../engine/characterLayout';
import { subscribe } from '../engine/MotionRuntime';

// Fonts, task titles, wrapping and scrolling affect the real placeholders.
export function useGridLayout(stage, gridRef) {
  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!stage || !grid) return;
    const room = grid.closest('[data-room]');
    let scrollY = window.scrollY;
    const measure = () => {
      const slots = new Map();
      for (const el of grid.querySelectorAll('[data-figure-placeholder]')) {
        const rect = el.getBoundingClientRect();
        // CSS nod/tremble is decorative, not a new walking destination.
        // Reading its translated rectangle made figures chase the jitter,
        // then apply the same tremble a second time on their sprite.
        let dx = 0, dy = 0;
        for (let parent = el.parentElement; parent && parent !== room; parent = parent.parentElement) {
          const transform = getComputedStyle(parent).transform;
          if (transform && transform !== 'none' && typeof DOMMatrixReadOnly === 'function') {
            const matrix = new DOMMatrixReadOnly(transform);
            dx += matrix.m41; dy += matrix.m42;
          }
        }
        if (rect.width && rect.height) slots.set(el.dataset.figurePlaceholder, { x: rect.x + rect.width / 2 - dx, y: rect.y + rect.height / 2 - dy });
      }
      const footer = room?.querySelector('[data-card-picker], [data-split-picker], [data-status-bar]');
      const floor = footer ? footer.getBoundingClientRect().top : window.innerHeight - 16;
      const delta = scrollY - window.scrollY;
      scrollY = window.scrollY;
      stage.updateLayout(slots, floor - SPRITE_H / 2 - 12, delta);
    };
    measure();
    // Never publish React/layout updates inside ResizeObserver delivery: WebKit
    // detects the resulting measurement/render feedback as an observer loop.
    let dirty = false;
    const unsubscribe = subscribe(() => {
      if (!dirty) return;
      dirty = false;
      measure();
    });
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(() => { dirty = true; }) : null;
    observer?.observe(grid);
    if (room) for (const el of room.children) observer?.observe(el);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, { passive: true });
    document.fonts?.addEventListener?.('loadingdone', measure);
    return () => {
      observer?.disconnect();
      unsubscribe();
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure);
      document.fonts?.removeEventListener?.('loadingdone', measure);
    };
  });
}
