import { describe, expect, it } from 'vitest';
import type { OperationOutputFor } from '@shop/contract';
import { mapMemberships } from './infrastructure/AccountMapper';

describe('membership mapping', () => {
  it('keeps the server-selected membership and access version authoritative', () => {
    const input: OperationOutputFor<'identity.memberships.read'> = {
      items: [
        membership('membership:one', 'mall:one', '一号商城', true, 8),
        membership('membership:two', 'mall:two', '二号商城', false, 3),
      ],
      count: 2,
    };
    const memberships = mapMemberships(input);
    expect(memberships.find(({ current }) => current)).toMatchObject({ id: 'membership:one', organizationId: 'mall:one', accessVersion: 8 });
    expect(Object.isFrozen(memberships)).toBe(true);
  });
});

function membership(id: string, scopeId: string, organizationName: string, current: boolean, accessVersion: number) {
  return { id, target: 'storefront' as const, displayName: '测试员工', organizationName, scopeKind: 'mall', scopeId, roleLabel: '员工', logoUrl: null, current, accessVersion };
}
