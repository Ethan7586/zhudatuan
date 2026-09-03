import { describe, expect, it } from 'vitest';
import type { OperationOutputFor } from '@shop/contract';
import { mapFavorites, mapMemberships } from './infrastructure/AccountMapper';

describe('account membership mapping', () => {
  it('preserves the authoritative membership, organization and version', () => {
    const input: OperationOutputFor<'identity.memberships.read'> = {
      items: [{ id: 'membership:one', target: 'storefront', displayName: '张三', organizationName: '研发中心福利商城', scopeKind: 'mall', scopeId: 'mall:one', roleLabel: '员工', logoUrl: null, current: true, accessVersion: 7 }],
      count: 1,
    };
    expect(mapMemberships(input)).toEqual([{ id: 'membership:one', organizationId: 'mall:one', name: '研发中心福利商城', current: true, accessVersion: 7 }]);
  });

  it('maps persisted favorites without manufacturing product state', () => {
    const input: OperationOutputFor<'member.favorites.read'> = {
      items: [{ listingId: 'listing:one', createdAt: '2026-08-31T00:00:00.000Z' }],
      count: 1,
    };
    expect(mapFavorites(input)).toEqual([{ listingId: 'listing:one', createdAt: '2026-08-31T00:00:00.000Z' }]);
  });
});
