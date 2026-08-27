import { afterEach, describe, expect, it, vi } from 'vitest';
import { hashPassword } from './registrationSecurity';
import { handleChangePassword, handleRevokeOtherSessions, handleSecurityOtp } from './securityCenterRoutes';
import { createSessionCookie } from './session';
import type { AuthorizationContext, WorkerEnv } from './types';

afterEach(() => vi.unstubAllGlobals());

const env: WorkerEnv = {
  APP_ENV: 'production',
  AUTH_MODE: 'membership',
  SUPABASE_URL: 'https://db.example',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role',
  SESSION_SIGNING_KEY: 'storefront-session-key-that-is-longer-than-32-bytes',
  ADMIN_SESSION_SIGNING_KEY: 'admin-session-key-that-is-longer-than-32-bytes',
  IDENTITY_LOOKUP_KEY: 'identity-lookup-key-that-is-longer-than-32-bytes',
  PII_ENCRYPTION_KEY: 'pii-key-that-is-longer-than-thirty-two-bytes',
};

const authorization = {
  tenantId: 'tenant-one',
  enterpriseId: 'enterprise-one',
  mallId: 'mall-one',
  mallCode: 'MALL',
  userId: 'user-one',
  employeeNo: 'E-001',
  roles: ['employee'],
  permissions: [],
  stepUpAt: null,
  membership: {
    id: 'membership-one',
    memberId: 'member-one',
    target: 'storefront',
    status: 'active',
    roleIds: ['employee'],
    permissions: [],
    deniedPermissions: [],
    context: { tenantId: 'tenant-one', enterpriseId: 'enterprise-one', mallId: 'mall-one', userId: 'user-one' },
    scopeBindings: [{ kind: 'self', resourceId: 'user-one' }],
    expiresAt: null,
    authzVersion: 1,
  },
} satisfies AuthorizationContext;

async function sessionCookie() {
  return (
    await createSessionCookie(env, 'E-001', 'MALL', {
      target: 'storefront',
      memberId: 'member-one',
      membershipId: 'membership-one',
      authzVersion: 1,
      sessionId: '10000000-0000-4000-8000-000000000001',
    })
  ).split(';', 1)[0];
}

describe('account security center routes', () => {
  it('changes a real local password and preserves only the current tracked session', async () => {
    const currentHash = await hashPassword('CurrentPassword2026');
    const rpcNames: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) => {
        const name = String(input).split('/').pop() ?? '';
        rpcNames.push(name);
        const value = name === 'api_member_credential' ? { passwordHash: currentHash, credentialVersion: 1 } : true;
        return new Response(JSON.stringify(value), { status: 200, headers: { 'content-type': 'application/json' } });
      })
    );
    const response = await handleChangePassword(
      new Request('https://hbbtzn.com/api/v1/auth/password/change', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: await sessionCookie() },
        body: JSON.stringify({ currentPassword: 'CurrentPassword2026', newPassword: 'NextPassword2026' }),
      }),
      env,
      authorization,
      'change-password'
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ changed: true, otherSessionsRevoked: true });
    expect(rpcNames).toEqual(['api_member_credential', 'api_member_credential', 'api_change_local_password']);
  });

  it('rejects the wrong current password without changing anything', async () => {
    const currentHash = await hashPassword('CurrentPassword2026');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ passwordHash: currentHash }), { status: 200, headers: { 'content-type': 'application/json' } }))
    );
    const response = await handleChangePassword(
      new Request('https://hbbtzn.com/api/v1/auth/password/change', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ currentPassword: 'WrongPassword2026', newPassword: 'NextPassword2026' }),
      }),
      env,
      authorization,
      'wrong-password'
    );
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'CURRENT_PASSWORD_INVALID' } });
  });

  it('keeps production OTP fail-closed until a real SMS provider is configured', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const response = await handleSecurityOtp(new Request('https://hbbtzn.com/api/v1/auth/security/otp', { method: 'POST' }), env, 'otp-production');
    expect(response.status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('requires a signed-in account before issuing a phone-change challenge', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const response = await handleSecurityOtp(
      new Request('https://hbbtzn.com/api/v1/auth/security/otp', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mobile: '13800138000', purpose: 'phone_change' }),
      }),
      { ...env, APP_ENV: 'test', AUTH_MODE: 'test', SMS_PROVIDER: 'debug' },
      'phone-change-without-session'
    );
    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('revokes all other sessions while retaining the current device', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('2', { status: 200, headers: { 'content-type': 'application/json' } }))
    );
    const response = await handleRevokeOtherSessions(
      new Request('https://hbbtzn.com/api/v1/auth/sessions/revoke-others', {
        method: 'POST',
        headers: { cookie: await sessionCookie() },
      }),
      env,
      authorization,
      'revoke-others'
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ revokedCount: 2 });
  });
});
