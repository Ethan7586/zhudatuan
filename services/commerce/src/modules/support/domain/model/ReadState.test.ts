import { describe, expect, it } from 'vitest';
import { ReadState } from './ReadState';

describe('ReadState', () => {
  it('advances monotonically and increments version only on progress', () => {
    const initial = new ReadState('conversation:one', 'membership:one', 8, 3);
    expect(initial.advance(7)).toBe(initial);
    expect(initial.advance(8)).toBe(initial);
    expect(initial.advance(12)).toEqual(new ReadState('conversation:one', 'membership:one', 12, 4));
  });

  it('rejects negative and fractional sequences', () => {
    const state = new ReadState('conversation:one', 'membership:one', 0, 1);
    expect(() => state.advance(-1)).toThrow('SUPPORT_READ_SEQUENCE_INVALID');
    expect(() => state.advance(1.2)).toThrow('SUPPORT_READ_SEQUENCE_INVALID');
  });
});
