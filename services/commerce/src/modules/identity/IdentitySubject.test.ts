import { describe, expect, it } from 'vitest';
import { canonicalIdentitySubject, canonicalMobile, identitySubjectVariants } from './IdentitySubject';

describe('canonical identity subjects', () => {
  it.each([
    ['13800138000', '+8613800138000'],
    ['8613800138000', '+8613800138000'],
    ['+8613800138000', '+8613800138000'],
    ['+1 (415) 555-2671', '+14155552671'],
  ])('normalizes %s to E.164 %s', (input, expected) => {
    expect(canonicalMobile(input)).toBe(expected);
  });

  it('uses the same canonical subject for Chinese national and E.164 forms', () => {
    expect(canonicalIdentitySubject('13800138000')).toBe(canonicalIdentitySubject('+8613800138000'));
    expect(identitySubjectVariants('+8613800138000')).toEqual(['+8613800138000', '13800138000']);
  });

  it('preserves normalized non-mobile usernames and rejects malformed phone-like values', () => {
    expect(canonicalIdentitySubject(' Ethan ')).toBe('ethan');
    expect(() => canonicalMobile('01234')).toThrow('VALIDATION_FAILED');
  });
});
