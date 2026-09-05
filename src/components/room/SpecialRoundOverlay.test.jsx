import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import SpecialRoundOverlay from './SpecialRoundOverlay';
import { setMotionMode } from '../../engine/motionProbe';
import { __testing__ as motion } from '../../engine/MotionRuntime';

afterEach(() => { vi.useRealTimers(); setMotionMode('full'); });
describe('split round spectacle', () => {
  it.each(['full', 'none'])('restores the original unframed title, zoom overshoot and pulsing stars in %s mode', mode => {
    vi.useFakeTimers(); vi.setSystemTime(10000); setMotionMode(mode);
    const view = render(<SpecialRoundOverlay timestamp={10000} />);
    const content = view.container.querySelector('[data-special-content]');
    expect(content).not.toBeNull();
    expect([...content.children].slice(0, 5).map(el => el.textContent).join('')).toBe('✦ ✦ ✦SPECIALROUND!FE / BE✦ ✦ ✦');
    expect(view.container.querySelector('[data-special-punchline]').style.opacity).toBe('0');
    expect(view.container.querySelector('.pixel-special-panel, [data-split-intro-card], [data-split-burst]')).toBeNull();
    expect(content.style.transform).toBe('scale(0.3) rotate(-5deg)');
    act(() => { vi.setSystemTime(10300); motion.forceTick(); });
    expect(content.style.transform).toBe('scale(1.1) rotate(2deg)');
    const stars = view.container.querySelector('[data-special-stars]');
    expect(Number(stars.style.opacity)).toBeGreaterThan(.8);
    act(() => { vi.setSystemTime(10900); motion.forceTick(); });
    expect(content.style.transform).toBe('scale(1) rotate(0deg)');
    expect(view.container.querySelector('[data-special-punchline]').style.opacity).toBe('1');
    expect(view.getByText('Two cards. Same deadline.')).toBeTruthy();
    act(() => { vi.setSystemTime(12500); motion.forceTick(); });
    expect(view.container.querySelector('[data-special-round]')).toBeNull();
  });
  it('keeps the original composition still for reduced motion and skips expired events', () => {
    vi.useFakeTimers(); vi.setSystemTime(10000); setMotionMode('reduced');
    const view = render(<SpecialRoundOverlay timestamp={10000} />);
    expect(view.container.querySelector('[data-split-burst]')).toBeNull();
    expect(view.container.querySelector('[data-special-content]').style.transform).toBe('scale(1) rotate(0deg)');
    expect(view.container.querySelector('[data-special-stars]').style.transform).toBe('scale(1)');
    view.unmount();
    expect(render(<SpecialRoundOverlay timestamp={9000} />).container.childElementCount).toBe(0);
  });
});
