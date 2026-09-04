import { describe, expect, it, vi } from 'vitest';
import { PERMISSIONS, type Membership } from '@smart-wing/api-contract';
import { handleCreateCustomRole, handleCustomRoleCenter, handleSetCustomRoleStatus, handleUpdateCustomRole } from './customRoleRoutes';
import type { AuthorizationContext } from './types';

function context(permissions: Membership['permissions'], stepUpAt: string | null = new Date().toISOString()): AuthorizationContext {
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
  return { tenantId: 'tenant-a', enterpriseId: 'enterprise-a', mallId: 'mall-a', mallCode: 'MALL_A', userId: 'user-owner', employeeNo: 'OWNER', roles: membership.roleIds, permissions, membership, stepUpAt };
}
const env = { SUPABASE_URL: 'https://supabase.example', SUPABASE_SERVICE_ROLE_KEY: 'key' };

describe('custom role center routes', () => {
  it('requires role.read before loading center', async () => {
    const fetchRpc = vi.spyOn(globalThis, 'fetch');
    const response = await handleCustomRoleCenter(new Request('https://smart.example/api/v1/admin/roles'), {}, context([]), 'role-read-denied');
    expect(response.status).toBe(403);
    expect(fetchRpc).not.toHaveBeenCalled();
    fetchRpc.mockRestore();
  });

  it('requires a recent step-up before creating roles', async () => {
    const response = await handleCreateCustomRole(new Request('https://smart.example/api/v1/admin/roles', { method: 'POST' }), {}, context([PERMISSIONS.roleCreate], null), 'role-step-up');
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'STEP_UP_REQUIRED' } });
  });

  it('sends validated custom role fields and actor evidence', async () => {
    const fetchRpc = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ id: 'role-custom', status: 'active' }), { status: 200, headers: { 'content-type': 'application/json' } }));
    try {
      const response = await handleCreateCustomRole(
        new Request('https://smart.example/api/v1/admin/roles', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ code: 'support_lead', name: '客服组长', description: '客服管理模板', permissionCodes: ['member.read', 'member.read'], reason: '建立客服组长岗位模板' }),
        }),
        env,
        context([PERMISSIONS.roleCreate]),
        'role-create'
      );
      expect(response.status).toBe(201);
      const rpc = JSON.parse(String(fetchRpc.mock.calls[0][1]?.body));
      expect(rpc).toMatchObject({ p_actor_membership_id: 'membership-owner', p_code: 'support_lead', p_name: '客服组长', p_permission_codes: ['member.read'], p_source_role_id: null });
    } finally {
      fetchRpc.mockRestore();
    }
  });

  it('rejects mixing clone source and manually selected permissions', async () => {
    const response = await handleCreateCustomRole(
      new Request('https://smart.example/api/v1/admin/roles', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ code: 'clone_role', name: '复制角色', permissionCodes: ['member.read'], sourceRoleId: 'role-a', reason: '复制角色测试验证' }),
      }),
      {},
      context([PERMISSIONS.roleCreate]),
      'role-clone-invalid'
    );
    expect(response.status).toBe(422);
  });

  it('uses role.update for enabling and role.delete for disabling', async () => {
    const fetchRpc = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ id: 'role-a' }), { status: 200, headers: { 'content-type': 'application/json' } }));
    try {
      const denied = await handleSetCustomRoleStatus(
        new Request('https://smart.example/api/v1/admin/roles/role-a/status', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'disabled', reason: '岗位已经取消停用角色' }) }),
        {},
        context([PERMISSIONS.roleUpdate]),
        'role-a',
        'role-disable-denied'
      );
      expect(denied.status).toBe(403);
      const enabled = await handleSetCustomRoleStatus(
        new Request('https://smart.example/api/v1/admin/roles/role-a/status', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ status: 'active', reason: '恢复岗位重新启用角色' }) }),
        env,
        context([PERMISSIONS.roleUpdate]),
        'role-a',
        'role-enable'
      );
      expect(enabled.status).toBe(200);
    } finally {
      fetchRpc.mockRestore();
    }
  });

  it('requires role.update for editing', async () => {
    const response = await handleUpdateCustomRole(new Request('https://smart.example/api/v1/admin/roles/role-a', { method: 'PUT' }), {}, context([PERMISSIONS.roleRead]), 'role-a', 'role-update-denied');
    expect(response.status).toBe(403);
  });
});
