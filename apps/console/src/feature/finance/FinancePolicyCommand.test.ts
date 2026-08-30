// @vitest-environment node
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { completeFinancePolicyStepup, executeFinancePolicyChange, previewFinancePolicyChange, startFinancePolicyStepup } from './FinancePolicyCommand';
import type { FinanceTaxPolicy } from './FinancePolicyEditorSchema';

const previewHash = 'a'.repeat(64);
const sourceHash = 'b'.repeat(64);
const revisionHash = 'c'.repeat(64);
const requests: Request[] = [];
const bodies: unknown[] = [];

const server = setupServer(
  http.post('*/api/v1/finance/policies/:policyid/preview', async ({ request }) => {
    requests.push(request);
    const body = await request.clone().json();
    bodies.push(body);
    return HttpResponse.json({
      preview: {
        id: 'policypreview:one',
        policyId: 'policy:tax:cn-standard',
        scopeId: 'mall:one',
        ...(body as object),
        effectiveFrom: '2026-08-30',
        effectiveTo: null,
        sourceVersion: '0',
        sourceHash,
        previewHash,
        expiresAt: '2099-08-30T01:00:00.000Z',
        proposedBy: 'actor:finance',
      },
    });
  }),
  http.post('*/api/v1/identity/stepup/challenges', ({ request }) => {
    requests.push(request);
    return HttpResponse.json({ id: 'challenge:one', purpose: 'stepup', expires_at: '2099-08-30T01:00:00.000Z' }, { status: 202 });
  }),
  http.post('*/api/v1/identity/stepup/verifications', async ({ request }) => {
    requests.push(request);
    const body = (await request.clone().json()) as { action: Record<string, unknown> };
    bodies.push(body);
    return HttpResponse.json({
      id: 'session:one',
      assurance_level: 3,
      actionProof: {
        proof: 'p'.repeat(64),
        operation: 'finance.policies.manage',
        resource: 'mall:one',
        scope: 'mall:one',
        idempotencyKey: body.action.idempotencyKey,
        expectedVersion: body.action.expectedVersion,
        requestHash: body.action.requestHash,
        expiresAt: '2099-08-30T01:00:00.000Z',
      },
    });
  }),
  http.put('*/api/v1/finance/policies/:policyid', async ({ request }) => {
    requests.push(request);
    const body = await request.clone().json();
    bodies.push(body);
    return HttpResponse.json({
      policy: {
        id: 'policy:tax:cn-standard',
        scopeId: 'mall:one',
        kind: 'tax',
        rule: taxPolicy.rule,
        state: 'draft',
        desiredState: 'active',
        version: '1',
        effectiveFrom: '2026-08-30',
        effectiveTo: null,
        sourceHash,
        revisionHash,
        previewHash,
        proposedBy: 'actor:finance',
        submittedBy: null,
        approvedBy: null,
        rejectedBy: null,
        actedBy: 'actor:finance',
        reason: '新增中国标准税率',
        evidence: { source: 'owner-approved' },
        createdAt: '2026-08-30T00:00:00.000Z',
        submittedAt: null,
        decidedAt: null,
      },
    });
  })
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  requests.length = 0;
  bodies.length = 0;
});
afterAll(() => server.close());

describe('finance policy critical-write workflow', () => {
  it('binds preview, OTP step-up, proof, expectedVersion, idempotency and authoritative receipt', async () => {
    const prepared = await previewFinancePolicyChange(context, {
      policy: taxPolicy,
      action: 'saveDraft',
      desiredState: 'active',
      reason: '新增中国标准税率',
      evidence: { source: 'owner-approved' },
    });
    const challenge = await startFinancePolicyStepup(context);
    const proof = await completeFinancePolicyStepup(context, prepared, challenge.id, '123456');
    const receipt = await executeFinancePolicyChange(context, prepared, proof);

    expect(receipt.policy).toMatchObject({ id: taxPolicy.id, state: 'draft', version: 1, previewHash });
    expect(prepared.requestHash).toMatch(/^[0-9a-f]{64}$/);
    expect(requests[0]?.headers.get('idempotency-key')).toMatch(/^[0-9a-f-]{36}$/);
    const completeBody = bodies[1] as { action: { requestHash: string; request: { path: unknown; body: unknown }; resource: string } };
    expect(completeBody.action).toMatchObject({ requestHash: prepared.requestHash, resource: 'mall:one' });
    expect(completeBody.action.request).toEqual({ path: { policyid: taxPolicy.id }, query: {}, body: prepared.body });
    const manage = requests.find((request) => request.method === 'PUT');
    expect(manage?.headers.get('x-action-proof')).toBe('p'.repeat(64));
    expect(manage?.headers.get('idempotency-key')).toBe(prepared.idempotencyKey);
    expect(manage?.headers.get('if-match')).toBe('"0"');
    expect(manage?.headers.get('x-scope-hint')).toBe('mall:one');
    expect(manage?.headers.get('x-csrf-token')).toBe('csrf-token-for-finance');
  });

  it('fails before transport when the session lacks manage, step-up, or CSRF bindings', async () => {
    const unavailable = { ...context, session: { ...context.session, capabilities: ['finance.policies.preview'], csrf: undefined } };
    await expect(
      previewFinancePolicyChange(unavailable, {
        policy: taxPolicy,
        action: 'saveDraft',
        desiredState: 'active',
        reason: '新增中国标准税率',
        evidence: {},
      })
    ).rejects.toThrow('FINANCE_POLICY_WRITE_NOT_AVAILABLE');
    expect(requests).toHaveLength(0);

    const noStepup = {
      ...context,
      session: {
        ...context.session,
        capabilities: ['finance.policies.preview', 'finance.policies.manage'],
      },
    };
    await expect(
      previewFinancePolicyChange(noStepup, {
        policy: taxPolicy,
        action: 'saveDraft',
        desiredState: 'active',
        reason: '新增中国标准税率',
        evidence: {},
      })
    ).rejects.toThrow('FINANCE_POLICY_WRITE_NOT_AVAILABLE');
    expect(requests).toHaveLength(0);
  });

  it('rejects a proof whose server binding does not match the prepared command', async () => {
    server.use(
      http.post('*/api/v1/identity/stepup/verifications', async ({ request }) => {
        const body = (await request.json()) as { action: Record<string, unknown> };
        return HttpResponse.json({
          id: 'session:one',
          assurance_level: 3,
          actionProof: {
            proof: 'p'.repeat(64),
            operation: 'finance.policies.manage',
            resource: 'mall:other',
            scope: 'mall:one',
            idempotencyKey: body.action.idempotencyKey,
            expectedVersion: body.action.expectedVersion,
            requestHash: body.action.requestHash,
            expiresAt: '2099-08-30T01:00:00.000Z',
          },
        });
      })
    );
    const prepared = await previewFinancePolicyChange(context, {
      policy: taxPolicy,
      action: 'saveDraft',
      desiredState: 'active',
      reason: '新增中国标准税率',
      evidence: {},
    });
    await expect(completeFinancePolicyStepup(context, prepared, 'challenge:one', '123456')).rejects.toThrow('FINANCE_POLICY_ACTION_PROOF_MISMATCH');
    expect(requests.some((request) => request.method === 'PUT')).toBe(false);
  });
});

const taxPolicy: FinanceTaxPolicy = {
  id: 'policy:tax:cn-standard',
  scope_id: 'mall:one',
  kind: 'tax',
  state: 'draft',
  version: 0,
  rule: {
    name: '中国标准税率',
    countryCode: 'CN',
    taxType: 'vat',
    productTaxCategory: 'standard_goods',
    ratePpm: 130_000,
    priceInclusive: true,
    calculationMethod: 'inclusive',
    roundingMode: 'line',
    priority: 100,
    effectiveFrom: '2026-08-30',
    sourceReference: 'owner-approved',
  },
};

const context: ConsoleContext = {
  session: {
    actor: 'actor:finance',
    membership: 'membership:finance',
    accessVersion: 7,
    permissions: ['finance.policy.manage'],
    capabilities: ['identity.stepup.start', 'identity.stepup.complete', 'finance.policies.preview', 'finance.policies.manage'],
    assurance: { level: 1 },
    csrf: 'csrf-token-for-finance',
    target: 'console',
    scope: { kind: 'mall', id: 'mall:one' },
    scopes: [{ kind: 'mall', id: 'mall:one' }],
    syncedAt: '2026-08-30T00:00:00.000Z',
  },
  profile: { display_name: '财务操作员', employee_no: null },
  scope: { kind: 'mall', id: 'mall:one' },
  scopes: [{ kind: 'mall', id: 'mall:one' }],
};
