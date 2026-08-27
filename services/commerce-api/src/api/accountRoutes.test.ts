import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleBootstrap } from './accountRoutes';
import type { AuthorizationContext, WorkerEnv } from './types';

const environment = {
  SUPABASE_URL: 'https://db.example',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role',
} satisfies WorkerEnv;

const authorization = {
  tenantId: 'tenant-one',
  enterpriseId: 'enterprise-one',
  mallId: 'mall-one',
  mallCode: 'MALL',
  userId: 'user-ethan',
  employeeNo: 'REG-OLD',
  roles: ['employee'],
  permissions: ['catalog.read'],
  stepUpAt: null,
  membership: {
    id: 'membership-ethan',
    memberId: 'member-ethan',
    target: 'storefront',
    status: 'active',
    roleIds: ['employee'],
    permissions: ['catalog.read'],
    deniedPermissions: [],
    expiresAt: null,
    authzVersion: 1,
    context: { tenantId: 'tenant-one', enterpriseId: 'enterprise-one', mallId: 'mall-one', userId: 'user-ethan' },
    scopeBindings: [{ kind: 'self', resourceId: 'user-ethan' }],
  },
} satisfies AuthorizationContext;

afterEach(() => vi.unstubAllGlobals());

describe('storefront bootstrap member identity', () => {
  it('returns the authenticated database profile instead of a demo person', async () => {
    const responses = [
      { mallName: '智慧翼商城', brandName: '智慧翼', enterpriseName: '演示企业' },
      {
        level: 'account',
        accountAuthenticated: true,
        accountAuthenticatedAt: '2026-08-13T00:00:00Z',
        phoneVerified: false,
        phoneVerifiedAt: null,
        phoneVerificationMethod: null,
        paymentEligible: false,
        restrictedCapabilities: ['order.create', 'payment.execute'],
      },
      { displayName: 'ethan', employeeNo: 'REG-ETHAN', departmentName: null, phoneMasked: null },
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(responses.shift()), { status: 200, headers: { 'content-type': 'application/json' } }))
    );

    const response = await handleBootstrap(new Request('https://hbbtzn.com/api/v1/bootstrap'), environment, authorization, 'profile-test');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      actor: { userId: 'user-ethan', employeeNo: 'REG-ETHAN', displayName: 'ethan', departmentName: null, phoneMasked: null },
    });
  });

  it('fails closed when the authenticated member profile cannot be resolved', async () => {
    const responses = [{ mallName: '智慧翼商城', brandName: '智慧翼', enterpriseName: '演示企业' }, null, null];
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(responses.shift()), { status: 200, headers: { 'content-type': 'application/json' } }))
    );

    const response = await handleBootstrap(new Request('https://hbbtzn.com/api/v1/bootstrap'), environment, authorization, 'missing-profile');

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'MEMBER_PROFILE_UNAVAILABLE' } });
  });
});
