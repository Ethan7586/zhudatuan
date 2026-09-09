import { describe, expect, it } from 'vitest';
import { FixedChallengeCode, RandomChallengeCode } from './ChallengeCodes';

describe('identity challenge codes', () => {
  it('issues six digit cryptographically random production codes', () => {
    const codes = new RandomChallengeCode();
    expect(codes.issue('login')).toMatch(/^\d{6}$/);
    expect(new Set(Array.from({ length: 12 }, () => codes.issue('stepup'))).size).toBeGreaterThan(1);
  });

  it('keeps one validated code for explicitly configured local acceptance', () => {
    const codes = new FixedChallengeCode(' 246810 ');
    expect(codes.issue('login')).toBe('246810');
    expect(codes.issue('stepup')).toBe('246810');
    expect(() => new FixedChallengeCode('12345')).toThrow('IDENTITY_CHALLENGE_CODE_INVALID');
  });
});
