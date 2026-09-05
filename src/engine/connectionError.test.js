import { describe, expect, it } from 'vitest';
import { connectionErrorMessage } from './connectionError';

describe('connection error messages', () => {
  it.each([
    { code: 'PERMISSION_DENIED' },
    { code: 'database/permission-denied' },
    new Error('Permission denied'),
  ])('identifies denied server access from SDK error %s', error => {
    expect(connectionErrorMessage(error)).toMatch(/access was denied/);
    expect(connectionErrorMessage(error)).not.toMatch(/Check your connection/);
  });

  it.each([undefined, new Error('Network disconnected')])('keeps network recovery advice for other errors', error => {
    expect(connectionErrorMessage(error)).toMatch(/Check your connection/);
  });
});
