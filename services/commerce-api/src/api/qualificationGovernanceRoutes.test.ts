import { describe, expect, it, vi } from 'vitest';
import { PERMISSIONS, type Membership } from '@smart-wing/api-contract';
import { handleEmployeeQualification, handleQualificationGovernance, handleQualificationReview, handleQualificationSimulation } from './qualificationGovernanceRoutes';
import type { AuthorizationContext } from './types';

function context(permissions: Membership['permissions'], target: Membership['target'] = 'admin', stepUpAt: string | null = null, membershipId = 'membership-admin'): AuthorizationContext {
  const membership: Membership = {
    id: membershipId,
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
  return { tenantId: 'tenant-a', enterpriseId: 'enterprise-a', mallId: 'mall-a', mallCode: 'MALL_A', userId: 'user-a', employeeNo: 'U001', roles: membership.roleIds, permissions, membership, stepUpAt };
}
const env = { SUPABASE_URL: 'https://supabase.example', SUPABASE_SERVICE_ROLE_KEY: 'service-role' };
const jsonRequest = (url: string, method: string, body: object) => new Request(url, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

describe('qualification governance boundaries', () => {
  it('redacts employees when the caller can only manage configuration', async () => {
    const fetchRpc = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ changeRequests: [{ id: 'change-a' }], employees: [{ userId: 'secret-user' }] }), { status: 200, headers: { 'content-type': 'application/json' } }));
    try {
      const response = await handleQualificationGovernance(new Request('https://smart.example/api/v1/admin/qualification-center/governance'), env, context([PERMISSIONS.entitlementManage]), 'governance');
      await expect(response.json()).resolves.toMatchObject({ changeRequests: [{ id: 'change-a' }], employees: [], capabilities: { readEmployees: false, manageEmployees: false, approveChanges: false } });
    } finally {
      fetchRpc.mockRestore();
    }
  });

  it('requires fresh step-up for the independent critical approval permission', async () => {
    const response = await handleQualificationReview(
      jsonRequest('https://smart.example/review', 'POST', { changeRequestId: 'change-a', decision: 'approve', reason: '核对影响无误' }),
      {},
      context([PERMISSIONS.qualificationApprove]),
      'review-no-stepup'
    );
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: { code: 'STEP_UP_REQUIRED' } });
  });

  it('passes only server-owned reviewer identity to the review RPC', async () => {
    const fetchRpc = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({ changeRequestId: 'change-a', status: 'applied' }), { status: 200, headers: { 'content-type': 'application/json' } }));
    try {
      const response = await handleQualificationReview(
        jsonRequest('https://smart.example/review', 'POST', { changeRequestId: 'change-a', decision: 'approve', reason: '核对影响无误', actorUserId: 'forged' }),
        env,
        context([PERMISSIONS.qualificationApprove], 'admin', new Date().toISOString(), 'membership-reviewer'),
        'review'
      );
      expect(response.status).toBe(200);
      expect(JSON.parse(String(fetchRpc.mock.calls[0]?.[1]?.body))).toMatchObject({ p_actor_user_id: 'user-a', p_actor_membership_id: 'membership-reviewer', p_change_request_id: 'change-a' });
    } finally {
      fetchRpc.mockRestore();
    }
  });

  it('requires step-up and validates manual employee tags before writing', async () => {
    const invalid = await handleEmployeeQualification(
      jsonRequest('https://smart.example/employee', 'PUT', employeeInput([{ code: 'bad tag', startsAt: null, endsAt: null }])),
      {},
      context([PERMISSIONS.employeeQualificationManage], 'admin', new Date().toISOString()),
      'bad-tag',
      'employee-a'
    );
    expect(invalid.status).toBe(422);
    const noStepUp = await handleEmployeeQualification(jsonRequest('https://smart.example/employee', 'PUT', employeeInput([])), {}, context([PERMISSIONS.employeeQualificationManage]), 'employee-a', 'employee-no-step');
    expect(noStepUp.status).toBe(403);
  });

  it('runs the simulator only for a qualified admin and uses the current mall context', async () => {
    const fetchRpc = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({ visible: true, purchasable: false, purchaseReason: 'LIMIT' }), { status: 200, headers: { 'content-type': 'application/json' } }));
    try {
      const response = await handleQualificationSimulation(
        jsonRequest('https://smart.example/simulate', 'POST', { userId: 'employee-a', membershipId: 'storefront-a', skuId: 'sku-a', quantity: 2 }),
        env,
        context([PERMISSIONS.employeeQualificationRead]),
        'simulate'
      );
      expect(response.status).toBe(200);
      expect(JSON.parse(String(fetchRpc.mock.calls[0]?.[1]?.body))).toMatchObject({
        p_tenant_id: 'tenant-a',
        p_enterprise_id: 'enterprise-a',
        p_mall_id: 'mall-a',
        p_user_id: 'employee-a',
        p_membership_id: 'storefront-a',
        p_sku_id: 'sku-a',
        p_quantity: 2,
      });
    } finally {
      fetchRpc.mockRestore();
    }
  });
});

function employeeInput(tags: unknown[]) {
  return { expectedVersion: 0, cityCode: '310000', cityName: '上海', status: 'active', attributes: {}, tags, reason: '初始化员工标签' };
}
