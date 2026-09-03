import { describe, expect, it } from 'vitest';
import { mapMemberships } from '../../src/feature/membership/infrastructure/MembershipMapper';
import { membership } from '../TestData';

describe('membership contract', () => {
  it('preserves organization, scope, role and target presentation data', () => {
    const result = mapMemberships({ memberships: [membership], expiresAt: '2099-01-01T00:00:00.000Z', target: 'storefront' });
    expect(result.memberships[0]).toEqual(membership);
    expect(result).toMatchObject({ target: 'storefront', expiresAt: '2099-01-01T00:00:00.000Z' });
    expect(Object.isFrozen(result.memberships)).toBe(true);
  });
});
