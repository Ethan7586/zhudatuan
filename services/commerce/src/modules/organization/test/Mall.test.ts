import { describe, expect, it } from 'vitest';
import { Organization } from '../domain/model/Organization';
import { HierarchyPolicy } from '../domain/policy/HierarchyPolicy';
import { MallPolicy } from '../domain/policy/MallPolicy';
import { completeOpening } from './MallFixture';

const now = '2026-09-04T08:00:00.000Z';
const parent = new Organization({ id: 'enterprise:one', kind: 'enterprise', parentid: 'tenant:one', name: '示范企业', timezone: 'Asia/Shanghai', status: 'active', malllimit: 1, version: 3, createdat: now, updatedat: now });

describe('organization mall policies', () => {
  it('rejects hierarchy cycles, cross-scope parents and exhausted parent quotas', () => {
    const policy = new HierarchyPolicy();
    expect(() => policy.assertAcyclic('department:a', 'department:b', ['department:b'])).toThrow();
    expect(() => policy.assertMallParent({ parent, accessScope: 'enterprise:other', visible: false, activeMalls: 0, expectedVersion: 3 })).toThrow('SCOPE_DENIED');
    expect(() => policy.assertMallParent({ parent, accessScope: parent.id, visible: true, activeMalls: 1, expectedVersion: 3 })).toThrow('CAPABILITY_QUOTA_EXCEEDED');
    expect(() => policy.assertMallParent({ parent, accessScope: parent.id, visible: true, activeMalls: 0, expectedVersion: 2 })).toThrow('VERSION_CONFLICT');
  });

  it('normalizes the complete profile once and rejects an unsafe custom domain', () => {
    const policy = new MallPolicy();
    expect(
      policy.profile({
        code: ' welfare01 ',
        publicSlug: ' Mall-One ',
        brandName: ' 主打团福利 ',
        domain: { mode: 'custom', customDomain: 'SHOP.EXAMPLE.COM.' },
        ownerMembershipId: ' membership:owner ',
        currency: 'cny',
        theme: { preset: 'shop', primaryColor: '#e8502a', accentColor: '#ff8a34', logoObjectRef: ' object:logo ', faviconObjectRef: null },
        opening: completeOpening,
      })
    ).toEqual({
      code: 'WELFARE01',
      publicSlug: 'mall-one',
      brandName: '主打团福利',
      domain: { mode: 'custom', customDomain: 'shop.example.com' },
      ownerMembershipId: 'membership:owner',
      currency: 'CNY',
      theme: { preset: 'shop', primaryColor: '#E8502A', accentColor: '#FF8A34', logoObjectRef: 'object:logo', faviconObjectRef: null },
      opening: completeOpening,
    });
    expect(() =>
      policy.profile({
        code: 'WELFARE01',
        publicSlug: 'mall-one',
        brandName: '主打团福利',
        domain: { mode: 'custom', customDomain: 'localhost' },
        ownerMembershipId: 'membership:owner',
        currency: 'CNY',
        theme: { preset: 'shop', primaryColor: '#E8502A', accentColor: '#FF8A34', logoObjectRef: null, faviconObjectRef: null },
        opening: completeOpening,
      })
    ).toThrow();
    expect(() =>
      policy.profile({
        code: 'WELFARE01',
        publicSlug: 'mall-one',
        brandName: '主打团福利',
        domain: { mode: 'platform' },
        ownerMembershipId: 'membership:owner',
        currency: 'CNY',
        theme: { preset: 'shop', primaryColor: '#E8502A', accentColor: '#FF8A34', logoObjectRef: 'https://attacker.example/logo', faviconObjectRef: null },
        opening: completeOpening,
      })
    ).toThrow();
  });
});
