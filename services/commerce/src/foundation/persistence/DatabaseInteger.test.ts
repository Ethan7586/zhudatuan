import { describe, expect, it } from 'vitest';
import { databaseInteger, databaseSafeInteger } from './DatabaseInteger';

describe('databaseInteger', () => {
  it('normalizes PostgreSQL bigint strings without losing precision', () => {
    expect(databaseInteger('14')).toBe(14);
    expect(databaseInteger(3)).toBe(3);
  });

  it.each(['', '-1', '1.5', '9007199254740992', null])('rejects an unsafe database integer: %s', (value) => {
    expect(() => databaseInteger(value)).toThrow('DATABASE_INTEGER_INVALID');
  });

  it('supports signed database amounts while preserving the nonnegative version invariant', () => {
    expect(databaseSafeInteger('-25')).toBe(-25);
    expect(() => databaseInteger('-25')).toThrow('DATABASE_INTEGER_INVALID');
  });
});
