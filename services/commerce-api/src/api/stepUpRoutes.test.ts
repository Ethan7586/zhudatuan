import { describe, expect, it, vi } from 'vitest';
import { PERMISSIONS, type Membership } from '@smart-wing/api-contract';
import { handleStepUp } from './stepUpRoutes';
import type { AuthorizationContext, WorkerEnv } from './types';

const env: WorkerEnv = { APP_ENV: 'test', AUTH_MODE: 'test', SUPABASE_URL: 'https://supabase.example', SUPABASE_SERVICE_ROLE_KEY: 'key', ADMIN_SESSION_SIGNING_KEY: 'admin-session-key-that-is-longer-than-thirty-two-bytes' };
const membership: Membership = {
  id: 'membership-test-admin-001',
  memberId: 'member-test-admin-001',
  target: 'admin',
  status: 'active',
  roleIds: ['role-test-admin'],
  permissions: [PERMISSIONS.roleGrant],
  context: { tenantId: 'tenant-smart-wing', enterpriseId: 'enterprise-demo', mallId: 'mall-demo', userId: 'user-test-admin-001' },
  scopeBindings: [{ kind: 'enterprise', resourceId: 'enterprise-demo' }],
  expiresAt: null,
  authzVersion: 2,
};
const authorization: AuthorizationContext = {
  tenantId: 'tenant-smart-wing',
  enterpriseId: 'enterprise-demo',
  mallId: 'mall-demo',
  mallCode: 'SMART_WING_DEMO',
  userId: 'user-test-admin-001',
  employeeNo: 'admin001',
  roles: membership.roleIds,
  permissions: membership.permissions,
  membership,
  stepUpAt: null,
};

describe('step-up route', () => {
  it('rejects the wrong current password without writing audit', async () => {
    const fetchRpc = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('true', { status: 200, headers: { 'content-type': 'application/json' } }));
    try {
      const response = await handleStepUp(
        new Request('https://smart.hbbtzn.com/api/v1/auth/step-up', { method: 'POST', headers: { 'x-real-ip': '203.0.113.12' }, body: JSON.stringify({ password: 'wrong' }) }),
        env,
        authorization,
        'step-wrong'
      );
      expect(response.status).toBe(401);
      expect(fetchRpc).toHaveBeenCalledTimes(3);
      expect(String(fetchRpc.mock.calls[2]?.[0])).toContain('api_record_login_failure');
    } finally {
      fetchRpc.mockRestore();
    }
  });

  it('issues a fresh host-only admin session after a valid password', async () => {
    const fetchRpc = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('true', { status: 200, headers: { 'content-type': 'application/json' } }));
    try {
      const response = await handleStepUp(new Request('https://smart.hbbtzn.com/api/v1/auth/step-up', { method: 'POST', body: JSON.stringify({ password: '123456' }) }), env, authorization, 'step-ok');
      expect(response.status).toBe(200);
      expect(response.headers.get('set-cookie')).toContain('__Host-hbbtzn_admin_session=');
      expect(fetchRpc).toHaveBeenCalledTimes(5);
      await expect(response.json()).resolves.toMatchObject({ verified: true });
    } finally {
      fetchRpc.mockRestore();
    }
  });

  it('stops before password verification when the shared limiter is blocked', async () => {
    const fetchRpc = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('false', { status: 200, headers: { 'content-type': 'application/json' } }));
    try {
      const response = await handleStepUp(new Request('https://smart.hbbtzn.com/api/v1/auth/step-up', { method: 'POST', body: JSON.stringify({ password: '123456' }) }), env, authorization, 'step-limited');
      expect(response.status).toBe(429);
      expect(fetchRpc).toHaveBeenCalledTimes(1);
    } finally {
      fetchRpc.mockRestore();
    }
  });
});
