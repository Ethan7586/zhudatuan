import { describe, expect, it } from 'vitest';
import { retentionUntil } from './Retention';

describe('retentionUntil', () => {
  it('adds whole UTC days to a valid instant', () => {
    expect(retentionUntil(2, new Date('2026-09-06T00:00:00.000Z'))).toBe('2026-09-08T00:00:00.000Z');
  });

  it.each([0, -1, 1.5])('rejects an invalid day count %s', (days) => {
    expect(() => retentionUntil(days)).toThrow('RETENTION_INVALID');
  });
});
