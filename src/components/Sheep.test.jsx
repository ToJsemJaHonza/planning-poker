import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import Sheep from './Sheep';

describe('Sheep — smoke', () => {
  it('mounts without throwing', () => {
    expect(() => render(<Sheep />)).not.toThrow();
  });

  it('unmounts cleanly', () => {
    const { unmount } = render(<Sheep />);
    expect(() => unmount()).not.toThrow();
  });
});
