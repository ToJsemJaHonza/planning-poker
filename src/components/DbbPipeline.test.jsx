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
    // Advance past onDone at t=10700 in the enriched timeline.
    act(() => { vi.advanceTimersByTime(6000); });
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

  // Tomáš's figure is rendered by the shared CharacterStage as of the
  // unified-character-stage refactor; the DOM assertions that used to
  // live here (data-testid="dbb-tomas") no longer apply. Stage-driven
  // motion is covered by useEntranceDirector + usePlayerDirector tests.

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

    // After slideOut (> 7900 ms in the enriched timeline), transform should
    // be offscreen again.
    act(() => { vi.advanceTimersByTime(7500); });
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

    it('C3: during the bubble phase bubble is visible and label is painted on the pipe', () => {
      const { container } = render(
        <DbbPipeline fromSide="left" playerName="Tomáš" onPlayerExit={() => {}} onDone={() => {}} />
      );
      // Bubble phase begins at t=2200 in the enriched timeline.
      act(() => { vi.advanceTimersByTime(2500); });
      const label = container.querySelector('.dbb-label-on-pipe');
      expect(label).not.toBeNull();
      expect(label.parentElement.hasAttribute('data-dbb-segment')).toBe(true);
      expect(container.textContent).toContain('DBB message has arrived');
    });

    it('C3: at t=5000ms bubble is faded out, pipe label still painted on segment', () => {
      const { container } = render(
        <DbbPipeline fromSide="left" playerName="Tomáš" onPlayerExit={() => {}} onDone={() => {}} />
      );
      // Emerge starts at t=4800 in the enriched timeline; showBubble
      // (bubble || bubbleOut) is false from emerge onward.
      act(() => { vi.advanceTimersByTime(5000); });
      const label = container.querySelector('.dbb-label-on-pipe');
      expect(label).not.toBeNull();
      const bubble = Array.from(container.querySelectorAll('div')).find((d) =>
        (d.textContent || '').includes('DBB message has arrived')
      );
      expect(bubble).toBeUndefined();
    });

    // C2 used to assert Tomáš's directional emerge class. Tomáš is now
    // drawn by the CharacterStage, so there's no local emerge div to
    // carry that class — the corresponding test has been retired.
  });

  // -------------------------------------------------------------------------
  // Industrial decorator regression: bolt bands appear at t=1600+, gauge
  // lives on the last segment, packet particles stream during packetFlow,
  // the pipe group carries `dbb-rumble` during rumble/packetFlow.
  // -------------------------------------------------------------------------
  describe('DBB industrial decorators', () => {
    it('renders bolt bands once the bolt phase kicks in (t ≥ 1600ms)', () => {
      const { container } = render(
        <DbbPipeline fromSide="left" playerName="Tomáš" onPlayerExit={() => {}} onDone={() => {}} />
      );
      // Before bolt phase — no bolt bands yet (still in slideIn).
      act(() => { vi.advanceTimersByTime(1000); });
      expect(container.querySelectorAll('[data-testid="dbb-bolt-band"]').length).toBe(0);
      // After bolt phase kicks in.
      act(() => { vi.advanceTimersByTime(700); });
      const bolts = container.querySelectorAll('[data-testid="dbb-bolt-band"]');
      expect(bolts.length).toBeGreaterThan(0);
    });

    it('draws a gauge on the mouth-end segment once the pipe has landed', () => {
      const { container } = render(
        <DbbPipeline fromSide="top" playerName="Tomáš" onPlayerExit={() => {}} onDone={() => {}} />
      );
      act(() => { vi.advanceTimersByTime(2000); });
      const gauges = container.querySelectorAll('[data-testid="dbb-gauge"]');
      // Exactly one gauge — on the mouth-end segment.
      expect(gauges.length).toBe(1);
    });

    it('adds `dbb-rumble` to the pipe group during the rumble beat', () => {
      const { container } = render(
        <DbbPipeline fromSide="left" playerName="Tomáš" onPlayerExit={() => {}} onDone={() => {}} />
      );
      // Before rumble — no class.
      act(() => { vi.advanceTimersByTime(3500); });
      const group = container.querySelector('[data-dbb-pipe-group]');
      expect(group.className || '').not.toContain('dbb-rumble');
      // Rumble starts at t=4000.
      act(() => { vi.advanceTimersByTime(600); });
      expect(group.className).toContain('dbb-rumble');
    });

    it('streams packet particles during packetFlow (t ≈ 4300ms)', () => {
      const { container } = render(
        <DbbPipeline fromSide="right" playerName="Tomáš" onPlayerExit={() => {}} onDone={() => {}} />
      );
      // Before packetFlow — no packets.
      act(() => { vi.advanceTimersByTime(3000); });
      expect(container.querySelectorAll('[data-testid="dbb-packet"]').length).toBe(0);
      // After packetFlow kicks in.
      act(() => { vi.advanceTimersByTime(1400); });
      const packets = container.querySelectorAll('[data-testid="dbb-packet"]');
      expect(packets.length).toBe(3);
    });
  });
});
