import { describe, expect, it } from 'vitest';
import { allocateIdentityCodes, identityCodeCandidate, type IdentityCode } from './IdentityCode';

describe('identity display codes', () => {
  it('keeps fixed vectors stable and uses the intended lengths', () => {
    expect(identityCodeCandidate('mall:hbbtzn', 'operator', 'membership:operator:ethan')).toBe('OP-673MFC');
  });

  it('resolves a collision without changing the code shape', () => {
    const candidate = (membershipId: string, attempt: number): IdentityCode =>
      attempt === 0 ? 'OP-7K2M8Q' : membershipId === 'membership:a' ? 'OP-8R3A5B' : 'OP-9T4B6C';
    const result = allocateIdentityCodes(['membership:b', 'membership:a'], new Map(), new Set(), candidate);
    expect([...result.values()]).toEqual(['OP-7K2M8Q', 'OP-9T4B6C']);
    expect(new Set(result.values()).size).toBe(2);
  });

  it('preserves an existing assignment during later collisions', () => {
    const existing = new Map<string, IdentityCode>([['membership:a', 'OP-7K2M8Q']]);
    const candidate = (_membershipId: string, attempt: number): IdentityCode => attempt === 0 ? 'OP-7K2M8Q' : 'OP-8R3A5B';
    expect(allocateIdentityCodes(['membership:a', 'membership:b'], existing, new Set(existing.values()), candidate))
      .toEqual(new Map([['membership:a', 'OP-7K2M8Q'], ['membership:b', 'OP-8R3A5B']]));
  });
});
