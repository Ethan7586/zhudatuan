import { describe, expect, it, vi } from 'vitest';
import { PERMISSIONS, type Membership } from '@smart-wing/api-contract';
import { handleMembershipAccess, handleMembershipStatus, handlePermissionCommandCenter } from './permissionAdminRoutes';
import type { AuthorizationContext } from './types';

function context(permissions: Membership['permissions'], overrides: Partial<AuthorizationContext> = {}): AuthorizationContext {
  const membership: Membership = {
    id: 'membership-owner',
    memberId: 'member-owner',
    target: 'admin',
    status: 'active',
    roleIds: ['role-owner'],
    permissions,
    context: { tenantId: 'tenant-a', enterpriseId: 'enterprise-a', mallId: 'mall-a', userId: 'user-owner' },
    scopeBindings: [{ kind: 'tenant', resourceId: 'tenant-a' }],
    expiresAt: null,
    authzVersion: 3,
  };
  return {
    tenantId: 'tenant-a',
    enterpriseId: 'enterprise-a',
    mallId: 'mall-a',
    mallCode: 'MALL_A',
    userId: 'user-owner',
    employeeNo: 'OWNER',
    roles: membership.roleIds,
    permissions,
    membership,
    stepUpAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('permission command center routes', () => {
  it('requires both member and role read before querying', async () => {
    const fetchRpc = vi.spyOn(globalThis, 'fetch');
    const response = await handlePermissionCommandCenter(new Request('https://smart.example/api/v1/admin/access-control'), {}, context([PERMISSIONS.memberRead]), 'read-denied');
    expect(response.status).toBe(403);
    expect(fetchRpc).not.toHaveBeenCalled();
    fetchRpc.mockRestore();
  });

  it('rejects self access mutation before touching the database', async () => {
    const fetchRpc = vi.spyOn(globalThis, 'fetch');
    const authorization = context([PERMISSIONS.roleGrant, PERMISSIONS.scopeGrant]);
    const response = await handleMembershipAccess(new Request('https://smart.example/api/v1/admin/memberships/membership-owner/access', { method: 'PUT' }), {}, authorization, 'membership-owner', 'self-denied');
    expect(response.status).toBe(409);
    expect(fetchRpc).not.toHaveBeenCalled();
    fetchRpc.mockRestore();
  });

  it('only requests member contact fields when the actor may read PII', async () => {
    const fetchRpc = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ members: [] }), { status: 200, headers: { 'content-type': 'application/json' } }));
    try {
      await handlePermissionCommandCenter(
        new Request('https://smart.example/api/v1/admin/access-control'),
        { SUPABASE_URL: 'https://supabase.example', SUPABASE_SERVICE_ROLE_KEY: 'key' },
        context([PERMISSIONS.memberRead, PERMISSIONS.roleRead]),
        'read-masked'
      );
      expect(JSON.parse(String(fetchRpc.mock.calls[0][1]?.body))).toMatchObject({ p_include_pii: false });
    } finally {
      fetchRpc.mockRestore();
    }
  });

  it('requires recent verification for role and scope grants', async () => {
    const authorization = context([PERMISSIONS.roleGrant, PERMISSIONS.scopeGrant], { stepUpAt: null });
    const response = await handleMembershipAccess(new Request('https://smart.example/api/v1/admin/memberships/other/access', { method: 'PUT' }), {}, authorization, 'other', 'step-up');
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'STEP_UP_REQUIRED' } });
  });

  it('sends only validated roles, scopes, denies and server actor evidence', async () => {
    const fetchRpc = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ membershipId: 'other', authzVersion: 4 }), { status: 200, headers: { 'content-type': 'application/json' } }));
    try {
      const authorization = context([PERMISSIONS.roleGrant, PERMISSIONS.scopeGrant]);
      const response = await handleMembershipAccess(
        new Request('https://smart.example/api/v1/admin/memberships/other/access', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ roleIds: ['role-a', 'role-a'], scopes: [{ kind: 'mall', resourceId: 'mall-a' }], deniedPermissions: ['price.read.cost'], reason: '限制成本信息访问' }),
        }),
        { SUPABASE_URL: 'https://supabase.example', SUPABASE_SERVICE_ROLE_KEY: 'key' },
        authorization,
        'other',
        'access-write'
      );
      expect(response.status).toBe(200);
      const rpcBody = JSON.parse(String(fetchRpc.mock.calls[0][1]?.body));
      expect(rpcBody).toMatchObject({ p_actor_membership_id: 'membership-owner', p_target_membership_id: 'other', p_role_ids: ['role-a'], p_scopes: [{ kind: 'mall', resourceId: 'mall-a' }], p_denied_permission_codes: ['price.read.cost'] });
    } finally {
      fetchRpc.mockRestore();
    }
  });

  it('accepts every commercial hierarchy scope and leaves grant ceilings to the database', async () => {
    const fetchRpc = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ membershipId: 'other', authzVersion: 5 }), { status: 200, headers: { 'content-type': 'application/json' } }));
    try {
      const scopes = [
        { kind: 'platform', resourceId: 'platform-a' },
        { kind: 'distributor', resourceId: 'distributor-a' },
        { kind: 'brand', resourceId: 'brand-a' },
        { kind: 'store', resourceId: 'store-a' },
      ];
      const response = await handleMembershipAccess(
        new Request('https://smart.example/api/v1/admin/memberships/other/access', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ roleIds: ['role-a'], scopes, deniedPermissions: [], reason: '配置完整商业层级范围' }),
        }),
        { SUPABASE_URL: 'https://supabase.example', SUPABASE_SERVICE_ROLE_KEY: 'key' },
        context([PERMISSIONS.roleGrant, PERMISSIONS.scopeGrant]),
        'other',
        'full-scope-write'
      );
      expect(response.status).toBe(200);
      expect(JSON.parse(String(fetchRpc.mock.calls[0][1]?.body))).toMatchObject({ p_scopes: scopes });
    } finally {
      fetchRpc.mockRestore();
    }
  });

  it('cannot suspend itself even with member.disable', async () => {
    const response = await handleMembershipStatus(new Request('https://smart.example/api/v1/admin/memberships/membership-owner/status', { method: 'PUT' }), {}, context([PERMISSIONS.memberDisable]), 'membership-owner', 'self-status');
    expect(response.status).toBe(409);
  });

  it('requires the separate offboard permission to remove a member', async () => {
    const response = await handleMembershipStatus(
      new Request('https://smart.example/api/v1/admin/memberships/other/status', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'offboarded', reason: '人员正式离职' }) }),
      {},
      context([PERMISSIONS.memberDisable]),
      'other',
      'offboard-denied'
    );
    expect(response.status).toBe(403);
  });
});
