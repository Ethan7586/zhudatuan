import { describe, expect, it, vi } from 'vitest';
import { PERMISSIONS, type Membership } from '@smart-wing/api-contract';
import { handleAdminCatalog, handleAdminOverview, handleSetProductStatus } from './adminRoutes';
import type { AuthorizationContext } from './types';

function context(overrides: Partial<AuthorizationContext> = {}): AuthorizationContext {
  const membership: Membership = {
    id: 'membership-admin',
    memberId: 'member-fubao',
    target: 'admin',
    status: 'active',
    roleIds: ['role-mall-admin'],
    permissions: [PERMISSIONS.catalogRead, PERMISSIONS.orderRead],
    context: { tenantId: 'tenant-a', enterpriseId: 'enterprise-a', mallId: 'mall-a', userId: 'user-a' },
    scopeBindings: [{ kind: 'mall', resourceId: 'mall-a' }],
    expiresAt: null,
    authzVersion: 1,
  };
  return {
    tenantId: 'tenant-a',
    enterpriseId: 'enterprise-a',
    mallId: 'mall-a',
    mallCode: 'MALL_A',
    userId: 'user-a',
    employeeNo: 'U001',
    roles: ['role-mall-admin'],
    permissions: membership.permissions,
    membership,
    stepUpAt: null,
    ...overrides,
  };
}

describe('admin routes: authorization guardrails', () => {
  it('does not query data when catalogue permission is absent', async () => {
    const authorization = context({ permissions: [], membership: { ...context().membership, permissions: [] } });
    const response = await handleAdminCatalog(new Request('https://smart.example/api/v1/admin/products'), {}, authorization, 'catalog-denied');
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'FORBIDDEN', requestId: 'catalog-denied' } });
  });

  it('rejects a storefront membership before loading the admin overview', async () => {
    const authorization = context({ membership: { ...context().membership, target: 'storefront' } });
    const response = await handleAdminOverview(new Request('https://smart.example/api/v1/admin/overview'), {}, authorization, 'wrong-target');
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'FORBIDDEN', requestId: 'wrong-target' } });
  });

  it('rejects a product status mutation without publish permission before any write', async () => {
    const authorization = context();
    const response = await handleSetProductStatus(new Request('https://smart.example/api/v1/admin/products/product-a/status', { method: 'POST' }), {}, authorization, 'product-a', 'publish-denied');
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'FORBIDDEN', requestId: 'publish-denied' } });
  });

  it('returns the server-resolved employee number used by the admin profile', async () => {
    const responses = [
      new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } }),
      new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } }),
      new Response('0', { status: 200, headers: { 'content-type': 'application/json' } }),
    ];
    const fetchRpc = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => responses.shift()!);
    try {
      const authorization = context({ employeeNo: 'seller001', roles: ['role-test-seller'] });
      const response = await handleAdminOverview(new Request('https://smart.example/api/v1/admin/overview'), { SUPABASE_URL: 'https://supabase.example', SUPABASE_SERVICE_ROLE_KEY: 'service-role-key' }, authorization, 'overview-profile');
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({ authorization: { employeeNo: 'seller001', roles: ['role-test-seller'] } });
    } finally {
      fetchRpc.mockRestore();
    }
  });
});
