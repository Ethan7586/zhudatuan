import { describe, expect, it } from 'vitest';
import { GrantPlan } from './GrantPlan';

describe('GrantPlan', () => {
  it('has a deterministic digest independent of database row order and changes for authorization facts', () => {
    const roles = [
      { id: 'role:b', version: 2, kind: 'custom' as const, expiresAt: null },
      { id: 'role:a', version: 1, kind: 'system' as const, expiresAt: null },
    ];
    const permissions = [
      { code: 'order.read', effect: 'allow' as const, role: 'role:b', roleVersion: 2 },
      { code: 'cart.read', effect: 'allow' as const, role: 'role:a', roleVersion: 1 },
    ];
    const scopes = [
      { id: 'scope:b', kind: 'mall', scope: 'mall:b', path: 'tenant/mall:b', effect: 'allow' as const, version: 2, effectiveAt: '2026-08-30T00:00:00.000Z', expiresAt: null },
      { id: 'scope:a', kind: 'tenant', scope: 'tenant', path: 'tenant', effect: 'allow' as const, version: 1, effectiveAt: '2026-08-30T00:00:00.000Z', expiresAt: null },
    ];
    const left = new GrantPlan('storefront', 'mall:b', 'membership:one', 'principal:one', roles, permissions, scopes, 1, 'policy:one', 'hash');
    const right = new GrantPlan('storefront', 'mall:b', 'membership:one', 'principal:one', [...roles].reverse(), [...permissions].reverse(), [...scopes].reverse(), 1, 'policy:one', 'hash');
    expect(left.digest()).toBe(right.digest());
    expect(new GrantPlan('storefront', 'mall:b', 'membership:one', 'principal:one', roles, [{ ...permissions[0]!, effect: 'deny' }, permissions[1]!], scopes, 1, 'policy:one', 'hash').digest()).not.toBe(left.digest());
  });
});
