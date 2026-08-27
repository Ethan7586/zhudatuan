import { MEMBER_CODE_PROTOCOL, PERMISSIONS, type Permission } from '@smart-wing/api-contract';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleMemberCodeChallenge, handleRevokeMemberCodeChallenge, handleVerifyMemberCodeChallenge } from './memberCodeRoutes';
import type { AuthorizationContext, WorkerEnv } from './types';

const env = {
  SUPABASE_URL: 'https://db.example',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role',
} satisfies WorkerEnv;

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
    expiresAt: null,
    authzVersion: 7,
    context: { tenantId: 'tenant-one', enterpriseId: 'enterprise-one', mallId: 'mall-one', userId: 'user-one' },
    scopeBindings: [{ kind: 'self', resourceId: 'user-one' }],
  },
} satisfies AuthorizationContext;

afterEach(() => vi.unstubAllGlobals());

describe('dynamic member-code contract', () => {
  it('issues an opaque QR payload without persisting the credential', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const rpcBody = JSON.parse(String(init?.body));
      expect(rpcBody.p_credential_hash).toMatch(/^[A-Za-z0-9+/]+=*$/);
      expect(JSON.stringify(rpcBody)).not.toContain(MEMBER_CODE_PROTOCOL);
      return jsonResponse({
        issued: true,
        challengeId: '11111111-1111-4111-8111-111111111111',
        issuedAt: '2026-08-15T00:00:00.000Z',
        expiresAt: '2026-08-15T00:00:45.000Z',
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await handleMemberCodeChallenge(new Request('https://hbbtzn.com/api/v1/member-code/challenge', { method: 'POST' }), env, authorization, 'issue-code');
    const body = await response.json<Record<string, unknown>>();
    expect(response.status).toBe(201);
    expect(body).not.toHaveProperty('credential');
    expect(body.payload).toMatch(new RegExp(`^${MEMBER_CODE_PROTOCOL}[0-9a-f]{64}$`));
    expect(body.validSeconds).toBe(45);
    expect(body.matrix).toEqual(expect.arrayContaining([expect.any(Array)]));
  });

  it('rejects verifier accounts without the dedicated permission', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const response = await handleVerifyMemberCodeChallenge(jsonRequest('/api/v1/admin/member-code/verify', { payload: `${MEMBER_CODE_PROTOCOL}${'a'.repeat(64)}` }), env, authorization, 'verify-forbidden');
    expect(response.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('hashes the scanned credential before one-time verification', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const rpcBody = JSON.parse(String(init?.body));
      expect(rpcBody.p_credential_hash).toMatch(/^[A-Za-z0-9+/]+=*$/);
      expect(JSON.stringify(rpcBody)).not.toContain('b'.repeat(64));
      return jsonResponse({ verified: true, challengeId: '11111111-1111-4111-8111-111111111111', memberId: 'member-one' });
    });
    vi.stubGlobal('fetch', fetchMock);
    const adminAuthorization = withPermission(authorization, PERMISSIONS.memberCodeVerify);
    const response = await handleVerifyMemberCodeChallenge(jsonRequest('/api/v1/admin/member-code/verify', { payload: `${MEMBER_CODE_PROTOCOL}${'b'.repeat(64)}` }), env, adminAuthorization, 'verify-code');
    await expect(response.json()).resolves.toMatchObject({ verified: true, memberId: 'member-one' });
  });

  it('requires a valid challenge id before revocation', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const response = await handleRevokeMemberCodeChallenge(jsonRequest('/api/v1/member-code/challenge/revoke', { challengeId: 'bad' }), env, authorization, 'revoke-bad');
    expect(response.status).toBe(422);
  });
});

function jsonRequest(path: string, body: unknown): Request {
  return new Request(`https://hbbtzn.com${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), { status: 200, headers: { 'content-type': 'application/json' } });
}

function withPermission(context: AuthorizationContext, permission: Permission): AuthorizationContext {
  return {
    ...context,
    permissions: [...context.permissions, permission],
    membership: { ...context.membership, permissions: [...context.membership.permissions, permission] },
  };
}
