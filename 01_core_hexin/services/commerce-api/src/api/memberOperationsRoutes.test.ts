import { describe, expect, it, vi } from 'vitest';
import { PERMISSIONS, type Membership } from '@smart-wing/api-contract';
import { handleAdminCreateMember, handleCreateMemberInvite, handleMemberImport, handleMemberOperations } from './memberOperationsRoutes';
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
    authzVersion: 4,
  };
  return { tenantId: 'tenant-a', enterpriseId: 'enterprise-a', mallId: 'mall-a', mallCode: 'MALL_A', userId: 'user-owner', employeeNo: 'OWNER', roles: membership.roleIds, permissions, membership, stepUpAt };
}

const env = { SUPABASE_URL: 'https://supabase.example', SUPABASE_SERVICE_ROLE_KEY: 'key' };

describe('member operations routes', () => {
  it('requires member.read before loading operations data', async () => {
    const fetchRpc = vi.spyOn(globalThis, 'fetch');
    const response = await handleMemberOperations(new Request('https://smart.example/api/v1/admin/member-operations'), env, context([]), 'denied');
    expect(response.status).toBe(403);
    expect(fetchRpc).not.toHaveBeenCalled();
    fetchRpc.mockRestore();
  });

  it('only asks the RPC for PII and history when separately authorized', async () => {
    const fetchRpc = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ profiles: [] }), { status: 200, headers: { 'content-type': 'application/json' } }));
    try {
      await handleMemberOperations(new Request('https://smart.example/api/v1/admin/member-operations'), env, context([PERMISSIONS.memberRead]), 'read');
      expect(JSON.parse(String(fetchRpc.mock.calls[0][1]?.body))).toMatchObject({ p_include_pii: false, p_include_history: false, p_include_import_errors: false });
    } finally {
      fetchRpc.mockRestore();
    }
  });

  it('requires a recent step-up before creating an invitation', async () => {
    const fetchRpc = vi.spyOn(globalThis, 'fetch');
    const response = await handleCreateMemberInvite(
      new Request('https://smart.example/api/v1/admin/member-operations/invitations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ label: '新员工邀请', maxUses: 10, expiresAt: new Date(Date.now() + 86_400_000).toISOString() }),
      }),
      env,
      context([PERMISSIONS.memberInvite], null),
      'step-up'
    );
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'STEP_UP_REQUIRED' } });
    expect(fetchRpc).not.toHaveBeenCalled();
    fetchRpc.mockRestore();
  });

  it('hashes the temporary password and never sends it to the database RPC', async () => {
    const fetchRpc = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ status: 'active', membershipId: 'membership-new' }), { status: 200, headers: { 'content-type': 'application/json' } }));
    try {
      const response = await handleAdminCreateMember(
        new Request('https://smart.example/api/v1/admin/member-operations/members', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ username: 'new.user', password: 'Welcome12345', displayName: '新员工' }),
        }),
        env,
        context([PERMISSIONS.memberInvite]),
        'create'
      );
      expect(response.status).toBe(201);
      const call = fetchRpc.mock.calls.find(([, init]) => String(init?.body).includes('p_password_hash'));
      const body = JSON.parse(String(call?.[1]?.body));
      expect(body.p_password_hash).toMatch(/^pbkdf2-sha256\$/);
      expect(JSON.stringify(body)).not.toContain('Welcome12345');
    } finally {
      fetchRpc.mockRestore();
    }
  });

  it('does not include plaintext passwords in import error reports', async () => {
    const fetchRpc = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ id: 'job', status: 'failed' }), { status: 200, headers: { 'content-type': 'application/json' } }));
    try {
      const response = await handleMemberImport(
        new Request('https://smart.example/api/v1/admin/member-operations/imports', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ sourceName: 'members.csv', rows: [{ username: 'bad', password: 'weak', displayName: '错误行' }] }),
        }),
        env,
        context([PERMISSIONS.memberImport]),
        'import'
      );
      expect(response.status).toBe(207);
      const body = JSON.parse(String(fetchRpc.mock.calls[0][1]?.body));
      expect(body.p_errors[0].input.password).toBeUndefined();
      expect(JSON.stringify(body)).not.toContain('weak');
    } finally {
      fetchRpc.mockRestore();
    }
  });
});
