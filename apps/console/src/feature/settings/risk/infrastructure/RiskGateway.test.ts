// @vitest-environment node
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import { RiskGateway } from './RiskGateway';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('RiskGateway', () => {
  it('maps policy replay and case state into immutable models', async () => {
    server.use(http.get('https://shop.test/api/v1/risks', () => HttpResponse.json({ items: [policy, riskCase], count: 2 })));
    const page = await new RiskGateway('https://shop.test').read(context);
    expect(page.items).toMatchObject([
      { kind: 'policy', version: 4, replayState: 'passed' },
      { kind: 'case', version: 2, state: 'reviewing', actorName: '李小明' },
    ]);
    expect(Object.isFrozen(page.items[0])).toBe(true);
  });

  it('binds policy activation to csrf, expected version, proof and stable identity', async () => {
    const proof = 'p'.repeat(43);
    server.use(
      http.put('https://shop.test/api/v1/risks/policies/riskpolicy%3Aone', async ({ request }) => {
        expect(request.headers.get('if-match')).toBe('"4"');
        expect(request.headers.get('x-action-proof')).toBe(proof);
        expect(request.headers.get('idempotency-key')).toBe('identity:activate');
        expect(request.headers.get('x-csrf-token')).toBe('csrf-token');
        expect(await request.json()).toEqual({ action: 'activate', version: 3, rolloutPercent: 50 });
        return HttpResponse.json({
          id: 'riskpolicy:one',
          scope_id: 'mall:one',
          name: '结算风险',
          active_version: 3,
          status: 'active',
          baseline_version: 2,
          updated_at: '2026-09-03T00:00:00.000Z',
          next_version: 4,
          rollout_percent: 50,
          rule_hash: 'a'.repeat(64),
          version: 5,
        });
      })
    );
    await expect(new RiskGateway('https://shop.test').managePolicy(context, { action: 'activate', policy: 'riskpolicy:one', version: 3, rolloutPercent: 50, expectedVersion: 4, proof, identity: 'identity:activate' })).resolves.toMatchObject(
      { kind: 'policy', action: 'activate', version: 5, activeVersion: 3 }
    );
  });

  it('sends exact case evidence without persisting proof in the body', async () => {
    const proof = 'q'.repeat(43);
    server.use(
      http.put('https://shop.test/api/v1/risks/cases/riskcase%3Aone', async ({ request }) => {
        expect(request.headers.get('if-match')).toBe('"2"');
        expect(request.headers.get('x-action-proof')).toBe(proof);
        expect(await request.json()).toEqual({ action: 'clear', reason: '核对付款人与订单一致', evidence: { ticket: 'support:one' } });
        return HttpResponse.json({
          id: 'riskcase:one',
          decision_id: 'riskdecision:one',
          state: 'cleared',
          assigned_to: 'actor:admin',
          created_at: '2026-09-03T00:00:00.000Z',
          closed_at: null,
          scope_id: 'mall:one',
          outcome: 'deny',
          safe_reason: 'velocity',
          reviewed_by: 'actor:admin',
          review_reason: '核对付款人与订单一致',
          review_evidence: { ticket: 'support:one' },
          reviewed_at: '2026-09-03T00:01:00.000Z',
          resolution: 'cleared',
          version: 3,
        });
      })
    );
    await expect(
      new RiskGateway('https://shop.test').reviewCase(context, { case: 'riskcase:one', action: 'clear', reason: '核对付款人与订单一致', evidence: { ticket: 'support:one' }, expectedVersion: 2, proof, identity: 'identity:review' })
    ).resolves.toMatchObject({ kind: 'case', state: 'cleared', version: 3 });
  });
});

const policy = {
  id: 'riskpolicy:one',
  kind: 'policy',
  version: 4,
  name: '结算风险',
  status: 'active',
  active_version: 2,
  baseline_version: 1,
  rollout_percent: 100,
  rule_hash: 'a'.repeat(64),
  rule: {},
  candidate_version: 3,
  candidate_rollout: 50,
  candidate_hash: 'b'.repeat(64),
  candidate_rule: {},
  replay_state: 'passed',
  sample_count: 100,
  changed_count: 2,
  false_positive_rate: 0.01,
  preview: { samples: 100 },
  decision_id: null,
  outcome: null,
  case_state: null,
  safe_reason: null,
  actor_id: null,
  actor_display_name: null,
  actor_mobile_masked: null,
  score: null,
  evidence: null,
  created_at: null,
};
const riskCase = {
  id: 'riskcase:one',
  kind: 'case',
  version: 2,
  name: null,
  status: null,
  active_version: null,
  baseline_version: null,
  rollout_percent: null,
  rule_hash: null,
  rule: null,
  candidate_version: null,
  candidate_rollout: null,
  candidate_hash: null,
  candidate_rule: null,
  replay_state: null,
  sample_count: null,
  changed_count: null,
  false_positive_rate: null,
  preview: null,
  decision_id: 'riskdecision:one',
  outcome: 'deny',
  case_state: 'reviewing',
  safe_reason: 'velocity',
  actor_id: 'actor:one',
  actor_display_name: '李小明',
  actor_mobile_masked: '139****0002',
  score: 90,
  evidence: {},
  created_at: '2026-09-03T00:00:00.000Z',
};
const scope = { kind: 'mall', id: 'mall:one', name: '测试商城' } as const;
const context: ConsoleContext = {
  session: {
    actor: 'actor:admin',
    membership: 'membership:admin',
    accessVersion: 7,
    permissions: ['risk.read', 'risk.manage'],
    capabilities: ['risk.center.read', 'risk.policies.manage', 'risk.cases.review'],
    target: 'console',
    scope,
    scopes: [scope],
    assurance: { level: 3 },
    security: { hasLocalCredential: true, phoneMasked: null, passwordChangedAt: null },
    csrf: 'csrf-token',
    syncedAt: '2026-09-03T00:00:00.000Z',
  },
  profile: { display_name: '管理员', employee_no: 'A001' },
  scope,
  scopes: [scope],
};
