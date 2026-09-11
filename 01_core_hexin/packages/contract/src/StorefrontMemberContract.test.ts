import { describe, expect, it } from 'vitest';
import { OperationCatalog } from './OperationCatalog';
import {
  StorefrontMemberCustomProfileSchema,
  StorefrontMemberDetailSchema,
  StorefrontMemberInviteePageSchema,
  StorefrontMemberOrderPageSchema,
  StorefrontMemberPageSchema,
  StorefrontMemberProfileConfigSchema,
} from './StorefrontMemberContract';

const page = {
  items: [{
    membership_id: 'membership:storefront:one',
    display_name: '测试消费者',
    mobile_masked: '188****8866',
    identity_level: 'L6',
    identity_kind: 'consumer',
    membership_status: 'active',
    mobile_bound: true,
    wechat_bound: true,
    joined_at: '2026-09-07T08:00:00.000Z',
  }],
  count: 1,
} as const;

describe('storefront member read contract', () => {
  it('publishes an operator read operation on the existing member.read permission', () => {
    expect(OperationCatalog.get('member.storefront.members.read')).toMatchObject({
      method: 'GET', path: '/api/v1/member/storefront-members', audience: 'operator', permission: 'member.read',
    });
    expect(OperationCatalog.get('member.storefront.detail.read')).toMatchObject({
      method: 'GET', path: '/api/v1/member/storefront-members/{membershipid}', permission: 'member.read',
    });
    expect(OperationCatalog.get('member.storefront.invitees.read')).toMatchObject({
      method: 'GET', path: '/api/v1/member/storefront-members/{membershipid}/invitees', permission: 'member.read',
    });
    expect(OperationCatalog.get('member.storefront.orders.read')).toMatchObject({
      method: 'GET', path: '/api/v1/member/storefront-members/{membershipid}/orders', permission: 'member.read',
    });
    expect(OperationCatalog.get('member.storefront.config.read')).toMatchObject({
      method: 'GET', path: '/api/v1/member/storefront-profile-config', permission: 'member.read',
    });
    expect(OperationCatalog.get('member.storefront.config.manage')).toMatchObject({
      method: 'PUT', path: '/api/v1/member/storefront-profile-config', permission: 'member.read',
    });
    expect(OperationCatalog.get('member.storefront.custom.read')).toMatchObject({
      method: 'GET', path: '/api/v1/member/storefront-members/{membershipid}/custom-profile', permission: 'member.read',
    });
    expect(OperationCatalog.get('member.storefront.custom.manage')).toMatchObject({
      method: 'PUT', path: '/api/v1/member/storefront-members/{membershipid}/custom-profile', permission: 'member.read',
    });
  });

  it('accepts only the masked, membership-scoped read model', () => {
    expect(StorefrontMemberPageSchema.parse(page)).toEqual(page);
    expect(() => StorefrontMemberPageSchema.parse({
      ...page,
      items: [{ ...page.items[0], mobile_masked: '18800008866' }],
    })).toThrow('MASKED_MOBILE_REQUIRED');
    expect(() => StorefrontMemberPageSchema.parse({
      ...page,
      items: [{ ...page.items[0], mobile: '18800008866' }],
    })).toThrow();
  });

  it('accepts complete profile, invitation and order read models without exposing member profile ids', () => {
    const detail = {
      ...page.items[0],
      parent: { kind: 'mall', display_name: '宏泰甄选', identity_level: 'L1' },
      inviter: {
        display_name: '邀请人', mobile_masked: '155****5544', bound_at: '2026-09-06T08:00:00.000Z',
        expires_at: null, relationship_status: 'active',
      },
      invited_count: 1,
      order_count: 1,
      latest_order_at: '2026-09-07T08:00:00.000Z',
    } as const;
    expect(StorefrontMemberDetailSchema.parse(detail)).toEqual(detail);
    expect(StorefrontMemberInviteePageSchema.parse({
      items: [{
        membership_id: 'membership:invitee', display_name: '被邀请人', mobile_masked: '177****7755',
        membership_status: 'active', identity_level: 'L7', bound_at: '2026-09-06T08:00:00.000Z', expires_at: null,
        relationship_status: 'active',
      }],
      count: 1,
    })).toBeTruthy();
    expect(StorefrontMemberOrderPageSchema.parse({
      items: [{
        id: 'order:one', order_number: 'HT20260907001', total_minor: '12900', currency: 'CNY',
        payment_state: 'paid', fulfillment_state: 'shipped', aftersale_state: 'none',
        created_at: '2026-09-07T08:00:00.000Z',
      }],
      count: 1,
    })).toBeTruthy();
    expect(() => StorefrontMemberDetailSchema.parse({ ...detail, member_id: 'member:internal' })).toThrow();
    expect(StorefrontMemberPageSchema.parse({
      ...page,
      items: [{ ...page.items[0], identity_level: 'L11' }],
    }).items[0]?.identity_level).toBe('L11');
  });

  it('accepts mall-defined tags, seven field types and persisted custom values', () => {
    const config = {
      tags: [{ id: 'tag:vip', name: '重点会员', color: 'purple', sort_order: 0, enabled: true }],
      fields: ['text', 'number', 'date', 'select', 'multiselect', 'switch', 'remark'].map((type, index) => ({
        id: `field:${type}`, name: `字段 ${index + 1}`, type,
        options: type === 'select' || type === 'multiselect' ? ['选项一'] : [],
        sort_order: index, enabled: true,
      })),
    };
    expect(StorefrontMemberProfileConfigSchema.parse(config)).toEqual(config);
    expect(StorefrontMemberCustomProfileSchema.parse({
      system_tags: [{ code: 'active_member', name: '有效会员' }],
      custom_tag_ids: ['tag:vip'],
      custom_field_values: [{ field_id: 'field:text', value: '华东' }],
    })).toBeTruthy();
  });
});
