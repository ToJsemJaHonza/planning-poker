import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import DbbPipeline, { buildPipePath } from './DbbPipeline';

describe('DbbPipeline (GH issue #2)', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('fires onPlayerExit exactly once even if parent re-renders constantly', () => {
    const onPlayerExit = vi.fn();
    const onDone = vi.fn();
    const { rerender } = render(
      <DbbPipeline
        fromSide="top"
        playerName="Tomáš"
        onPlayerExit={onPlayerExit}
        onDone={onDone}
      />
    );
    // Simulate parent re-renders with new callback refs every 500 ms,
    // just like we do in the Train regression test.
    for (let i = 0; i < 10; i++) {
      act(() => { vi.advanceTimersByTime(500); });
      rerender(
        <DbbPipeline
          fromSide="top"
          playerName="Tomáš"
          onPlayerExit={() => onPlayerExit()}
          onDone={() => onDone()}
        />
      );
    }
    act(() => { vi.advanceTimersByTime(5000); });
    expect(onPlayerExit).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('mounts with a data-testid="dbb-pipeline"', () => {
    const { getByTestId } = render(
      <DbbPipeline fromSide="top" playerName="Tom" onPlayerExit={() => {}} onDone={() => {}} />
    );
    expect(getByTestId('dbb-pipeline')).toBeInTheDocument();
  });

  it('announces "DBB message has arrived — <name>" during the bubble phase', () => {
    const { container } = render(
      <DbbPipeline fromSide="left" playerName="Tomáš" onPlayerExit={() => {}} onDone={() => {}} />
    );
    // Bubble phase starts at 1800 ms
    act(() => { vi.advanceTimersByTime(2200); });
    expect(container.textContent).toContain('DBB message has arrived');
    expect(container.textContent).toContain('Tomáš');
  });

  it('renders DBB letters for all four entry sides', () => {
    for (const side of ['top', 'bottom', 'left', 'right']) {
      const { container, unmount } = render(
        <DbbPipeline fromSide={side} playerName="Tom" onPlayerExit={() => {}} onDone={() => {}} />
      );
      // Label is a child of the pipe segment — always rendered with the pipe.
      act(() => { vi.advanceTimersByTime(2000); });
      const label = container.querySelector('.dbb-label-on-pipe');
      expect(label).not.toBeNull();
      expect((label.textContent || '').trim()).toBe('DBB');
      unmount();
    }
  });

  // -------------------------------------------------------------------------
  // buildPipePath unit tests — pure function, no DOM needed
  // -------------------------------------------------------------------------
  describe('buildPipePath', () => {
    const vp = { w: 1024, h: 768 };

    it('returns exactly 3 segments for every anchor side', () => {
      for (const side of ['top', 'bottom', 'left', 'right']) {
        const p = buildPipePath(side, vp);
        expect(p.segments).toHaveLength(3);
      }
    });

    it('anchors the first segment flush with the expected edge', () => {
      // The first-segment start face touches the anchor edge. We check that
      // the bounding box of segment 0 touches the edge within 50px (the pipe
      // thickness — the box extends inward from the mouth center).
      const THICK = 50;
      const left = buildPipePath('left', vp);
      expect(left.segments[0].x).toBeLessThanOrEqual(0);
      expect(left.segments[0].x + THICK).toBeGreaterThanOrEqual(0);

      const right = buildPipePath('right', vp);
      expect(right.segments[0].x + right.segments[0].w).toBeGreaterThanOrEqual(vp.w - 1);

      const top = buildPipePath('top', vp);
      expect(top.segments[0].y).toBeLessThanOrEqual(0);

      const bot = buildPipePath('bottom', vp);
      expect(bot.segments[0].y + bot.segments[0].h).toBeGreaterThanOrEqual(vp.h - 1);
    });

    it('places the mouth strictly inside the viewport (away from the anchor edge)', () => {
      for (const side of ['top', 'bottom', 'left', 'right']) {
        const p = buildPipePath(side, vp);
        expect(p.mouth.x).toBeGreaterThan(0);
        expect(p.mouth.x).toBeLessThan(vp.w);
        expect(p.mouth.y).toBeGreaterThan(0);
        expect(p.mouth.y).toBeLessThan(vp.h);
      }
    });

    it('reports the mouth orientation matching the final segment direction', () => {
      // After the C2 fix, orientation is derived from the mouth direction
      // (last path step), not the middle segment.
      // left pipe path = [right, down, right] → last dir 'right' → horizontal
      expect(buildPipePath('left',   vp).orientation).toBe('horizontal');
      expect(buildPipePath('right',  vp).orientation).toBe('horizontal');
      // top pipe path = [down, right, down] → last dir 'down' → vertical
      expect(buildPipePath('top',    vp).orientation).toBe('vertical');
      expect(buildPipePath('bottom', vp).orientation).toBe('vertical');
    });
  });

  // -------------------------------------------------------------------------
  // Rendering / phase tests
  // -------------------------------------------------------------------------
  it('renders exactly 3 pipe segments for every fromSide', () => {
    for (const side of ['top', 'bottom', 'left', 'right']) {
      const { container, unmount } = render(
        <DbbPipeline fromSide={side} playerName="Tomáš" onPlayerExit={() => {}} onDone={() => {}} />
      );
      act(() => { vi.advanceTimersByTime(2000); });
      const segs = container.querySelectorAll('[data-dbb-segment]');
      expect(segs.length).toBe(3);
      unmount();
    }
  });

  it('does not render Tomáš until the emerge phase', () => {
    const { queryByTestId } = render(
      <DbbPipeline fromSide="left" playerName="Tomáš" onPlayerExit={() => {}} onDone={() => {}} />
    );
    // Before emerge (~3000 ms in — still bubbleOut)
    act(() => { vi.advanceTimersByTime(3000); });
    expect(queryByTestId('dbb-tomas')).toBeNull();

    // After emerge kicks in (~3700 ms in)
    act(() => { vi.advanceTimersByTime(800); });
    expect(queryByTestId('dbb-tomas')).not.toBeNull();
  });

  it('spawns Tomáš at the pipe mouth coordinates (non-zero, inside viewport)', () => {
    const { queryByTestId } = render(
      <DbbPipeline fromSide="left" playerName="Tomáš" onPlayerExit={() => {}} onDone={() => {}} />
    );
    act(() => { vi.advanceTimersByTime(3800); });
    const tomas = queryByTestId('dbb-tomas');
    expect(tomas).not.toBeNull();
    // Inline left/top should be non-empty and non-zero.
    expect(tomas.style.left).toBeTruthy();
    expect(tomas.style.top).toBeTruthy();
    const lx = parseInt(tomas.style.left, 10);
    const ty = parseInt(tomas.style.top, 10);
    expect(Number.isFinite(lx)).toBe(true);
    expect(Number.isFinite(ty)).toBe(true);
    expect(lx).toBeGreaterThan(0);
    expect(ty).toBeGreaterThan(0);
  });

  it('keeps Tomas transform applied after phase flips to slideOut (INV5)', () => {
    const { queryByTestId } = render(
      <DbbPipeline fromSide="top" playerName="Tomáš" onPlayerExit={() => {}} onDone={() => {}} />
    );

    // Advance past emerge (3600ms) and into the walk phase (4500ms)
    act(() => { vi.advanceTimersByTime(4500); });
    const tomas = queryByTestId('dbb-tomas');
    expect(tomas).not.toBeNull();
    const walkTransform = tomas.style.transform;
    expect(walkTransform).toMatch(/translate\(/);

    // Advance into slideOut phase (total 6800ms). The transform MUST still be
    // applied — this is the INV5 regression guard (previously it was stripped
    // and Tomáš teleported back to the mouth).
    act(() => { vi.advanceTimersByTime(2300); });
    const stillTomas = queryByTestId('dbb-tomas');
    expect(stillTomas).not.toBeNull();
    expect(stillTomas.style.transform).not.toBe('');
    expect(stillTomas.style.transform).toMatch(/translate\(/);
  });

  it('anchors the pipe group offscreen before slideIn and onscreen afterwards', () => {
    const { container } = render(
      <DbbPipeline fromSide="left" playerName="Tomáš" onPlayerExit={() => {}} onDone={() => {}} />
    );
    // Hidden phase — the wrapper should have an offscreen translate.
    const group = container.querySelector('[data-dbb-pipe-group]');
    expect(group).not.toBeNull();
    expect(group.style.transform).toContain('-120vw');

    // After slideIn starts (> 200 ms), transform should be onscreen.
    act(() => { vi.advanceTimersByTime(1000); });
    expect(group.style.transform).toContain('translate(0');

    // After slideOut (> 6700 ms), transform should be offscreen again.
    act(() => { vi.advanceTimersByTime(6000); });
    expect(group.style.transform).toContain('-120vw');
  });

  // ---------------------------------------------------------------------------
  // C1/C2/C3 regression guards
  // ---------------------------------------------------------------------------
  describe('DBB regression — C1/C2/C3 fixes', () => {
    it.each([
      ['left',  'right'],
      ['right', 'left'],
      ['top',   'down'],
      ['bottom','up'],
    ])('C2: mouth coords are at outer face for fromSide=%s', (side, expectedDir) => {
      const vp = { w: 1024, h: 768 };
      const p = buildPipePath(side, vp);
      const last = p.segments[p.segments.length - 1];
      expect(p.mouth.dir).toBe(expectedDir);
      if (expectedDir === 'right')  expect(p.mouth.x).toBeCloseTo(last.x + last.w, -1);
      if (expectedDir === 'left')   expect(p.mouth.x).toBeCloseTo(last.x, -1);
      if (expectedDir === 'down')   expect(p.mouth.y).toBeCloseTo(last.y + last.h, -1);
      if (expectedDir === 'up')     expect(p.mouth.y).toBeCloseTo(last.y, -1);
    });

    it.each(['left', 'right', 'top', 'bottom'])(
      'C1: DBB label is a child of a pipe segment for fromSide=%s',
      (side) => {
        const { container } = render(
          <DbbPipeline fromSide={side} playerName="Tomáš" onPlayerExit={() => {}} onDone={() => {}} />
        );
        // Advance past any phase where the label might be gated
        act(() => { vi.advanceTimersByTime(2000); });
        const label = container.querySelector('.dbb-label-on-pipe');
        expect(label).not.toBeNull();
        expect((label.textContent || '').trim()).toBe('DBB');
        // Parent must be a pipe segment, not a floating wrapper
        const parent = label.parentElement;
        expect(parent).not.toBeNull();
        expect(parent.hasAttribute('data-dbb-segment')).toBe(true);
      }
    );

    it('C3: at t=2000ms bubble is visible and label is painted on the pipe', () => {
      const { container } = render(
        <DbbPipeline fromSide="left" playerName="Tomáš" onPlayerExit={() => {}} onDone={() => {}} />
      );
      act(() => { vi.advanceTimersByTime(2000); });
      // Label lives inside a pipe segment — always in DOM with the pipe
      const label = container.querySelector('.dbb-label-on-pipe');
      expect(label).not.toBeNull();
      expect(label.parentElement.hasAttribute('data-dbb-segment')).toBe(true);
      // Bubble text is rendered
      expect(container.textContent).toContain('DBB message has arrived');
    });

    it('C3: at t=3900ms bubble is faded out, label and Tomáš are in DOM', () => {
      const { container, queryByTestId } = render(
        <DbbPipeline fromSide="left" playerName="Tomáš" onPlayerExit={() => {}} onDone={() => {}} />
      );
      act(() => { vi.advanceTimersByTime(3900); });
      const label = container.querySelector('.dbb-label-on-pipe');
      expect(label).not.toBeNull();
      expect(queryByTestId('dbb-tomas')).not.toBeNull();
      // Bubble is fully gone during emerge (showBubble false)
      const bubble = Array.from(container.querySelectorAll('div')).find((d) =>
        (d.textContent || '').includes('DBB message has arrived')
      );
      expect(bubble).toBeUndefined();
    });

    it('C2: Tomáš uses a directional emerge class matching mouth.dir', () => {
      const { queryByTestId } = render(
        <DbbPipeline fromSide="left" playerName="Tomáš" onPlayerExit={() => {}} onDone={() => {}} />
      );
      act(() => { vi.advanceTimersByTime(3800); });
      const tomas = queryByTestId('dbb-tomas');
      expect(tomas).not.toBeNull();
      // left fromSide → last seg dir = 'right' → class 'dbb-tomas-emerge-right'
      expect(tomas.className).toBe('dbb-tomas-emerge-right');
    });
  });
});
