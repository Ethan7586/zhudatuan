import { describe, expect, it } from 'vitest';
import { classifySignedLevel, signedLevelNumber } from './SignedLevel';

describe('original SFL signed level rules', () => {
  it.each([
    ['L-1', 'supply_side'],
    ['L0', 'member_l0_l5'],
    ['L5', 'member_l0_l5'],
    ['L6', 'member_l6_l11'],
    ['L11', 'member_l6_l11'],
  ] as const)('classifies %s as %s', (level, segment) => {
    expect(classifySignedLevel(level)).toBe(segment);
  });

  it('retains the original invalid-level result', () => {
    expect(signedLevelNumber('L6')).toBe(6);
    expect(() => classifySignedLevel('L12')).toThrow('SFL_SIGNED_LEVEL_INVALID');
    expect(() => classifySignedLevel('L-0')).toThrow('SFL_SIGNED_LEVEL_INVALID');
  });
});
