import { describe, expect, it, vi } from 'vitest';
import { PERMISSIONS, type Membership } from '@smart-wing/api-contract';
import { handleQualificationCenter, handleQualificationConfig } from './qualificationAdminRoutes';
import type { AuthorizationContext } from './types';

function context(permissions: Membership['permissions'], target: Membership['target'] = 'admin', stepUpAt: string | null = null): AuthorizationContext {
  const membership: Membership = {
    id: 'membership-admin',
    memberId: 'member-admin',
    target,
    status: 'active',
    roleIds: ['role-owner'],
    permissions,
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
    roles: membership.roleIds,
    permissions,
    membership,
    stepUpAt,
  };
}

describe('qualification center read boundary', () => {
  it('rejects a storefront membership before querying', async () => {
    const response = await handleQualificationCenter(new Request('https://smart.example/api/v1/admin/qualification-center'), {}, context([PERMISSIONS.entitlementRead], 'storefront'), 'wrong-target');
    expect(response.status).toBe(403);
  });

  it('requires at least one dedicated read permission', async () => {
    const response = await handleQualificationCenter(new Request('https://smart.example/api/v1/admin/qualification-center'), {}, context([PERMISSIONS.catalogRead]), 'missing-permission');
    expect(response.status).toBe(403);
  });

  it('rejects a membership whose scope does not include the current mall', async () => {
    const authorization = context([PERMISSIONS.entitlementRead]);
    authorization.membership.scopeBindings = [{ kind: 'mall', resourceId: 'mall-other' }];
    const response = await handleQualificationCenter(new Request('https://smart.example/api/v1/admin/qualification-center'), {}, authorization, 'scope-mismatch');
    expect(response.status).toBe(403);
  });

  it('returns capabilities derived from the current membership', async () => {
    const fetchRpc = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ catalogPools: [], cityZones: [], policies: [], limitTemplates: [], commercialSummary: {} }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );
    try {
      const response = await handleQualificationCenter(
        new Request('https://smart.example/api/v1/admin/qualification-center'),
        { SUPABASE_URL: 'https://supabase.example', SUPABASE_SERVICE_ROLE_KEY: 'service-role' },
        context([PERMISSIONS.entitlementRead, PERMISSIONS.purchaseLimitManage]),
        'qualified'
      );
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        capabilities: {
          readEntitlements: true,
          manageEntitlements: false,
          readPurchaseLimits: false,
          managePurchaseLimits: true,
        },
      });
    } finally {
      fetchRpc.mockRestore();
    }
  });

  it('removes commercial, limit and employee-selector data on the server for an entitlement-only reader', async () => {
    const fetchRpc = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          catalogPools: [{ id: 'pool-a' }],
          cityZones: [{ id: 'zone-a' }],
          policies: [{ id: 'policy-a' }],
          limitTemplates: [{ id: 'limit-a' }],
          commercialResources: { agreements: [{ id: 'agreement-a' }], brands: [], stores: [] },
          commercialSummary: { brands: 1 },
          selectors: { users: [{ id: 'user-secret' }], products: [{ id: 'product-a' }] },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      )
    );
    try {
      const response = await handleQualificationCenter(
        new Request('https://smart.example/api/v1/admin/qualification-center'),
        { SUPABASE_URL: 'https://supabase.example', SUPABASE_SERVICE_ROLE_KEY: 'service-role' },
        context([PERMISSIONS.entitlementRead]),
        'redaction'
      );
      await expect(response.json()).resolves.toMatchObject({
        catalogPools: [],
        cityZones: [{ id: 'zone-a' }],
        policies: [{ id: 'policy-a' }],
        limitTemplates: [],
        commercialResources: { agreements: [], brands: [], stores: [] },
        commercialSummary: { brands: 0 },
        selectors: { users: [], products: [] },
      });
    } finally {
      fetchRpc.mockRestore();
    }
  });
});

describe('qualification center write boundary', () => {
  it('rejects storefront and missing manage permission before querying', async () => {
    const storefront = await handleQualificationConfig(configRequest(draftPool()), {}, context([PERMISSIONS.commercialResourceManage], 'storefront'), 'storefront-write');
    expect(storefront.status).toBe(403);
    const missing = await handleQualificationConfig(configRequest(draftPool()), {}, context([PERMISSIONS.commercialResourceRead]), 'missing-manage');
    expect(missing.status).toBe(403);
  });

  it('requires an idempotency key for every write', async () => {
    const response = await handleQualificationConfig(configRequest(draftPool(), false), {}, context([PERMISSIONS.commercialResourceManage]), 'missing-key');
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'IDEMPOTENCY_KEY_REQUIRED' } });
  });

  it('allows a draft save without step-up and supplies server-owned actor context', async () => {
    const fetchRpc = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({ id: 'pool-new', version: 1, status: 'draft' }), { status: 200, headers: { 'content-type': 'application/json' } }));
    try {
      const response = await handleQualificationConfig(configRequest(draftPool()), { SUPABASE_URL: 'https://supabase.example', SUPABASE_SERVICE_ROLE_KEY: 'service-role' }, context([PERMISSIONS.commercialResourceManage]), 'draft-save');
      expect(response.status).toBe(201);
      const rpcBody = JSON.parse(String(fetchRpc.mock.calls[0]?.[1]?.body));
      expect(rpcBody).toMatchObject({ p_tenant_id: 'tenant-a', p_enterprise_id: 'enterprise-a', p_mall_id: 'mall-a', p_actor_user_id: 'user-a', p_actor_membership_id: 'membership-admin', p_kind: 'catalog_pool', p_expected_version: 0 });
      expect(rpcBody.p_payload).toMatchObject({ status: 'draft', skuIds: ['sku-a'] });
    } finally {
      fetchRpc.mockRestore();
    }
  });

  it('requires fresh step-up before publishing or disabling', async () => {
    const response = await handleQualificationConfig(configRequest({ ...draftPool(), payload: { ...draftPool().payload, status: 'active' } }), {}, context([PERMISSIONS.commercialResourceManage]), 'publish-no-step-up');
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'STEP_UP_REQUIRED' } });
  });

  it('publishes with fresh step-up and the permission dedicated to its kind', async () => {
    const fetchRpc = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ requiresApproval: false, affectedEmployees: 2, affectedSkus: 1 }), { status: 200, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'policy-a', version: 2, status: 'active' }), { status: 200, headers: { 'content-type': 'application/json' } }));
    try {
      const input = {
        kind: 'entitlement_policy',
        entityId: 'policy-a',
        expectedVersion: 1,
        reason: '开放华东员工购买',
        payload: { status: 'active', name: '华东员工可买', action: 'purchasable', effect: 'allow', priority: 100, reasonCode: 'EAST_ALLOW', subjects: [{ kind: 'tag', id: 'east' }], resources: [{ kind: 'all', id: '*' }] },
      };
      const response = await handleQualificationConfig(
        configRequest(input),
        { SUPABASE_URL: 'https://supabase.example', SUPABASE_SERVICE_ROLE_KEY: 'service-role' },
        context([PERMISSIONS.entitlementManage], 'admin', new Date().toISOString()),
        'publish'
      );
      expect(response.status).toBe(200);
      expect(fetchRpc.mock.calls[0]?.[0]).toContain('api_qualification_change_preview');
      expect(JSON.parse(String(fetchRpc.mock.calls[1]?.[1]?.body))).toMatchObject({ p_kind: 'entitlement_policy', p_entity_id: 'policy-a', p_expected_version: 1 });
    } finally {
      fetchRpc.mockRestore();
    }
  });

  it('queues a high-risk publish instead of applying it directly', async () => {
    const fetchRpc = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ requiresApproval: true, riskLevel: 'critical', affectedEmployees: 120, affectedSkus: 10 }), { status: 200, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ approvalRequired: true, changeRequestId: 'change-a', status: 'pending' }), { status: 200, headers: { 'content-type': 'application/json' } }));
    try {
      const input = { ...draftPool(), payload: { ...draftPool().payload, status: 'active', skuIds: Array.from({ length: 50 }, (_, index) => `sku-${index}`) } };
      const response = await handleQualificationConfig(
        configRequest(input),
        { SUPABASE_URL: 'https://supabase.example', SUPABASE_SERVICE_ROLE_KEY: 'service-role' },
        context([PERMISSIONS.commercialResourceManage], 'admin', new Date().toISOString()),
        'queue-high-risk'
      );
      expect(response.status).toBe(202);
      expect(fetchRpc.mock.calls[1]?.[0]).toContain('api_request_qualification_change');
      expect(fetchRpc.mock.calls.some(([url]) => String(url).includes('api_apply_qualification_config'))).toBe(false);
    } finally {
      fetchRpc.mockRestore();
    }
  });
});

function draftPool() {
  return { kind: 'catalog_pool', entityId: null, expectedVersion: 0, reason: '创建商城精选商品池', payload: { status: 'draft', code: 'MALL_SELECTED', name: '商城精选', poolKind: 'selected', skuIds: ['sku-a'] } };
}

function configRequest(body: object, withKey = true) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (withKey) headers['idempotency-key'] = 'qualification-test-key';
  return new Request('https://smart.example/api/v1/admin/qualification-center/config', { method: 'POST', headers, body: JSON.stringify(body) });
}
