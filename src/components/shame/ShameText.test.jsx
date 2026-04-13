import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import ShameText from './ShameText';

describe('ShameText — visibility', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('renders nothing when isHoldout=false regardless of stage', () => {
    const { container } = render(
      <ShameText stage={5} holdoutName="Karel" isHoldout={false} />
    );
    // Container should have no text content (no floating texts spawned)
    expect(container.textContent).toBe('');
  });

  it('renders nothing at stage=0 even for holdout', () => {
    const { container } = render(
      <ShameText stage={0} holdoutName="Karel" isHoldout={true} />
    );
    expect(container.textContent).toBe('');
  });

  it('renders floating text for holdout at stage >= 1', () => {
    const { container } = render(
      <ShameText stage={3} holdoutName="Karel" isHoldout={true} />
    );
    // After initial spawn, there should be at least one text element
    // (the component spawns immediately on mount)
    const texts = container.querySelectorAll('span');
    expect(texts.length).toBeGreaterThan(0);
  });
});
