import { describe, expect, it, vi } from 'vitest';
import { getDemoAccounts, resolveDemoMembership, verifyDemoPassword } from './demoAuth';

describe('role-based public test account roster', () => {
  it('exposes all 25 named accounts only in test mode', () => {
    const accounts = getDemoAccounts({ APP_ENV: 'test', AUTH_MODE: 'test' });
    const expected = ['buyer', 'seller', 'ops', 'cs', 'admin'].flatMap((prefix) => Array.from({ length: 5 }, (_, index) => `${prefix}${String(index + 1).padStart(3, '0')}`));

    expect(expected.every((username) => accounts.some((account) => account.username === username))).toBe(true);
    expect(new Set(accounts.map((account) => account.username)).size).toBe(accounts.length);
    expect(getDemoAccounts({ APP_ENV: 'production', AUTH_MODE: 'production' })).toEqual([]);
  });

  it('routes buyers to the storefront and the other roles to admin', () => {
    const accounts = getDemoAccounts({ APP_ENV: 'test', AUTH_MODE: 'test' });
    const buyer = accounts.find((account) => account.username === 'buyer001');
    const seller = accounts.find((account) => account.username === 'seller001');

    expect(buyer).toMatchObject({ storefrontMembershipId: 'membership-test-buyer-001' });
    expect(buyer?.adminMembershipId).toBeUndefined();
    expect(seller).toMatchObject({ adminMembershipId: 'membership-test-seller-001' });
    expect(seller?.storefrontMembershipId).toBeUndefined();
  });

  it('accepts only the configured password', async () => {
    await expect(verifyDemoPassword('123456', '123456')).resolves.toBe(true);
    await expect(verifyDemoPassword('password123', '123456')).resolves.toBe(false);
    await expect(verifyDemoPassword('admin123', '123456')).resolves.toBe(false);
  });

  it.each([
    ['buyer001', 'storefront', 'role-test-buyer', ['catalog.read', 'order.create', 'order.read']],
    ['seller001', 'admin', 'role-test-seller', ['catalog.read', 'product.publish', 'order.read', 'order.ship']],
    ['ops001', 'admin', 'role-test-operations', ['audit.read', 'catalog.read', 'order.read', 'order.ship', 'product.publish']],
    ['cs001', 'admin', 'role-test-customer-service', ['catalog.read', 'member.read', 'order.read']],
    ['admin001', 'admin', 'role-test-admin', ['audit.read', 'catalog.read', 'finance.reconcile', 'member.disable', 'member.invite', 'member.read', 'order.read', 'order.refund', 'order.ship', 'product.publish', 'role.read']],
  ] as const)('binds %s to its database-backed role and permissions', async (username, target, roleId, permissions) => {
    const account = getDemoAccounts({ APP_ENV: 'test', AUTH_MODE: 'test' }).find((candidate) => candidate.username === username);
    expect(account).toBeDefined();
    const fetchRpc = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          id: target === 'storefront' ? account?.storefrontMembershipId : account?.adminMembershipId,
          memberId: account?.memberId,
          target,
          status: 'active',
          roleIds: [roleId],
          permissions,
          context: { tenantId: 'tenant-smart-wing', enterpriseId: 'enterprise-demo', mallId: 'mall-demo', userId: `user-test-${username.slice(0, -3)}-${username.slice(-3)}` },
          scopeBindings:
            target === 'storefront'
              ? [{ kind: 'self', resourceId: `user-test-buyer-${username.slice(-3)}` }]
              : username.startsWith('admin')
                ? [
                    { kind: 'enterprise', resourceId: 'enterprise-demo' },
                    { kind: 'mall', resourceId: 'mall-demo' },
                  ]
                : [{ kind: 'mall', resourceId: 'mall-demo' }],
          expiresAt: null,
          authzVersion: 1,
          actor: { tenantId: 'tenant-smart-wing', enterpriseId: 'enterprise-demo', mallId: 'mall-demo', mallCode: 'SMART_WING_DEMO', userId: `user-test-${username.slice(0, -3)}-${username.slice(-3)}`, employeeNo: username },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );

    try {
      const runtime = await resolveDemoMembership({ APP_ENV: 'test', AUTH_MODE: 'test', SUPABASE_URL: 'https://supabase.example', SUPABASE_SERVICE_ROLE_KEY: 'service-role-key' }, account!, target);
      expect(runtime?.membership.roleIds).toEqual([roleId]);
      expect(runtime?.membership.permissions).toEqual(permissions);
    } finally {
      fetchRpc.mockRestore();
    }
  });
});
