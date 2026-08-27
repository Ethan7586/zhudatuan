import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadMemberAssurance, requirePhoneVerified } from './identityAssurance';
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
  permissions: ['order.create'],
  stepUpAt: null,
  membership: {
    id: 'membership-one',
    memberId: 'member-one',
    target: 'storefront',
    status: 'active',
    roleIds: ['employee'],
    permissions: ['order.create'],
    deniedPermissions: [],
    context: {
      tenantId: 'tenant-one',
      enterpriseId: 'enterprise-one',
      mallId: 'mall-one',
      userId: 'user-one',
    },
    scopeBindings: [{ kind: 'self', resourceId: 'user-one' }],
    expiresAt: null,
    authzVersion: 1,
  },
} satisfies AuthorizationContext;

afterEach(() => vi.unstubAllGlobals());

describe('member identity assurance', () => {
  it('fails closed when the assurance record is absent', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('null', { status: 200, headers: { 'content-type': 'application/json' } }))
    );
    const response = await requirePhoneVerified(env, authorization, 'missing-assurance');
    expect(response?.status).toBe(403);
    await expect(response?.json()).resolves.toMatchObject({
      error: { code: 'PHONE_VERIFICATION_REQUIRED' },
    });
  });

  it('rejects an account-only member without invoking any payment operation', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              level: 'account',
              accountAuthenticated: true,
              accountAuthenticatedAt: '2026-08-13T00:00:00Z',
              phoneVerified: false,
              phoneVerifiedAt: null,
              phoneVerificationMethod: null,
              paymentEligible: false,
              restrictedCapabilities: ['order.create', 'payment.execute'],
            }),
            { status: 200, headers: { 'content-type': 'application/json' } }
          )
      )
    );
    expect(await requirePhoneVerified(env, authorization, 'account-only')).toBeInstanceOf(Response);
  });

  it('accepts a phone-verified member and exposes the persisted assurance', async () => {
    const assurance = {
      level: 'phone' as const,
      accountAuthenticated: true,
      accountAuthenticatedAt: '2026-08-13T00:00:00Z',
      phoneVerified: true,
      phoneVerifiedAt: '2026-08-13T00:05:00Z',
      phoneVerificationMethod: 'sms_otp',
      paymentEligible: true,
      restrictedCapabilities: [],
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(assurance), { status: 200, headers: { 'content-type': 'application/json' } }))
    );
    expect(await requirePhoneVerified(env, authorization, 'phone-verified')).toBeNull();
    await expect(loadMemberAssurance(env, 'member-one')).resolves.toEqual(assurance);
  });
});
