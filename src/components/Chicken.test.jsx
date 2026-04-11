import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import Chicken from './Chicken';

describe('Chicken — smoke', () => {
  it('mounts without throwing', () => {
    expect(() => render(<Chicken />)).not.toThrow();
  });

  it('unmounts cleanly', () => {
    const { unmount } = render(<Chicken />);
    expect(() => unmount()).not.toThrow();
  });
});
