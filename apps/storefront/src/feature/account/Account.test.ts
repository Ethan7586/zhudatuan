import { describe, expect, it } from 'vitest';
import type { OperationOutputFor } from '@shop/contract';
import { mapAddresses, mapFavorites, mapMemberships } from './infrastructure/AccountMapper';

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
      items: [{ listingId: 'listing:one', createdAt: '2026-08-31T00:00:00.000Z', version: 2, available: false, unavailableReason: '商品已下架，可取消收藏' }],
      count: 1,
    };
    expect(mapFavorites(input)).toEqual([{ listingId: 'listing:one', createdAt: '2026-08-31T00:00:00.000Z', version: 2, available: false, unavailableReason: '商品已下架，可取消收藏' }]);
  });

  it('uses the server default-address decision instead of list position', () => {
    expect(
      mapAddresses({
        items: [
          { id: 'address:one', recipient_masked: '王**', mobile_masked: '138****0000', address_masked: '创新大道***', region_code: '四川省/成都市/高新区', is_default: false, status: 'active', version: 1 },
          { id: 'address:two', recipient_masked: '李**', mobile_masked: '139****0000', address_masked: '天府大道***', region_code: '四川省/成都市/高新区', is_default: true, status: 'active', version: 3 },
        ],
        count: 2,
      })
    ).toMatchObject([
      { id: 'address:one', isDefault: false },
      { id: 'address:two', isDefault: true },
    ]);
  });
});
