import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import CharacterSprite from './CharacterSprite';
import PmSprite from './PmSprite';
import { createCharacter } from '../engine/character';

describe('PM ban hammer grip', () => {
  it('keeps the speech bubble above the taller BONK head', () => {
    const view = render(<PmSprite model={{ mode: 'ceremony', hammer: { angle: 18 },
      showBubble: true, bubble: 'BONK!' }} />);
    expect(view.getByText('BONK!').style.bottom).toBe('170px');
  });
  it.each([false, true])('stays attached inside the PM facing transform (left=%s)', facingLeft => {
    const pm = createCharacter({ id: 'pm', sprite: 'pm', position: { x: 300, y: 400 }, facingLeft });
    pm.hammer = { angle: 25 };
    pm.pose = 'cast';
    const { container, rerender } = render(<CharacterSprite character={pm} />);
    const sprite = container.querySelector('[data-cm-pm-ceremony]');
    const hand = sprite.querySelector('[data-pm-hammer]');
    expect(hand).not.toBeNull();
    expect(hand.style.left).toBe('35px'); // right palm: PM sprite column 7
    expect(hand.style.top).toBe('40px'); // PM sprite row 8
    const label = hand.querySelector('[data-hammer-lettering]');
    expect(label.dataset.label).toBe('BONK');
    expect(label.textContent).toBe(''); // lettering is bitmap pixels, never tiny font text
    expect(label.style.transform).toBe(facingLeft ? 'scaleX(-1)' : 'scaleX(1)');
    expect(label.querySelectorAll('svg[shape-rendering="crispEdges"]')).toHaveLength(1);
    expect(label.querySelector('rect').getAttribute('width')).toBe('5');
    expect(label.querySelector('rect').getAttribute('height')).toBe('8');
    expect(hand.querySelector('[data-hammer-body]').style.transformOrigin).toBe('60px 120px');
    expect(hand.querySelector('[data-hammer-art] rect[fill="#ef3f35"]')).not.toBeNull();
    expect(sprite.style.transform).toBe(facingLeft ? 'scaleX(-1)' : 'scaleX(1)');
    // The pointer's blue pixels must be absent while this hand holds a hammer.
    expect(sprite.firstElementChild.firstElementChild.style.boxShadow).not.toContain('#2980b9');
    for (const angle of [-110, -45, 0, 95]) {
      pm.hammer = { angle };
      rerender(<CharacterSprite character={pm} />);
      const body = hand.querySelector('[data-hammer-body]');
      expect(body.style.transform).toBe(`rotate(${angle}deg)`);
      // Handle's rotation pivot maps back onto the stationary palm, not the
      // old attachment 74 pixels beneath it. Knuckles cover this same point.
      const [x, y] = body.style.transformOrigin.split(' ').map(parseFloat);
      expect(parseFloat(body.style.left) + x).toBe(0);
      expect(parseFloat(body.style.top) + y).toBe(0);
      expect(hand.lastElementChild.hasAttribute('data-hammer-grip')).toBe(true);
    }
    pm.hammer = null;
    rerender(<CharacterSprite character={pm} />);
    expect(container.querySelector('[data-pm-hammer]')).toBeNull();
  });
});
