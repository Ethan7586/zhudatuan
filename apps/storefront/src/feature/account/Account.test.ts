import { describe, expect, it } from 'vitest';
import type { OperationOutputFor } from '@shop/contract';
import { mapAddresses, mapFavorites, mapMemberships, mapProfile } from './infrastructure/AccountMapper';
import { presentCurrentMall } from './model/MallPresentation';

describe('account membership mapping', () => {
  it('preserves the authoritative membership, organization and version', () => {
    const input: OperationOutputFor<'identity.memberships.read'> = {
      items: [{ id: 'membership:one', target: 'storefront', displayName: '张三', organizationName: '研发中心福利商城', scopeKind: 'mall', scopeId: 'mall:one', roleLabel: '员工', logoUrl: null, current: true, accessVersion: 7 }],
      count: 1,
    };
    expect(mapMemberships(input)).toEqual([{ id: 'membership:one', organizationId: 'mall:one', name: '研发中心福利商城', roleLabel: '员工', current: true, accessVersion: 7 }]);
  });

  it('keeps technical identities out of beginner-facing profile fallbacks', () => {
    const profile = mapProfile({
      id: 'member:one',
      display_name: '张三',
      status: 'active',
      mobile_bound: true,
      membership_id: 'membership:one',
      organization_id: 'mall-zhudatuan',
      employee_no: null,
      joined_at: '2026-09-01T00:00:00.000Z',
      access_version: 2,
      locale: 'zh-CN',
      timezone: 'Asia/Shanghai',
      marketing_allowed: false,
      preference_version: 1,
    });
    const mall = presentCurrentMall('mall-zhudatuan');
    expect(profile).toMatchObject({ employeeNumber: null, department: '所属部门未设置', enterpriseName: '当前企业' });
    expect(mall).toMatchObject({ enterpriseName: '当前企业', mallName: '企业福利商城', roleLabel: '企业成员' });
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
