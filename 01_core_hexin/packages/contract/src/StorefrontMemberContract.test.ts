import { describe, expect, it } from 'vitest';
import { OperationCatalog } from './OperationCatalog';
import { StorefrontMemberPageSchema } from './StorefrontMemberContract';

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
});
