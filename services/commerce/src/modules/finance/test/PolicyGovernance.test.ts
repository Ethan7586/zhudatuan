import { describe, expect, it, vi } from 'vitest';
import type { SqlExecutor } from '../../../adapter/database/PgTransactionAccess';
import type { Clock } from '../../../foundation/domain/Clock';
import { FinancePolicy } from '../domain/model/FinancePolicy';
import { PolicyPreview } from '../domain/policy/PolicyPreview';
import { policyCommands } from '../infrastructure/persistence/PolicyCommands';
import type { FinanceAction, FinanceRequest } from '../infrastructure/persistence/FinanceOperation';
import type { FinanceScopeQuery } from '../infrastructure/persistence/FinanceScopeQuery';

const now = new Date('2026-09-07T08:00:00.000Z');
const sample = Object.freeze({ from: '2026-09-01T00:00:00.000Z', to: '2026-10-01T00:00:00.000Z', affectedCount: 17 });
const entries = Object.freeze([
  Object.freeze({ account: 'expense.goods', debitMinor: 100, creditMinor: 0, currency: 'CNY', memo: '商品成本' }),
  Object.freeze({ account: 'liability.payable', debitMinor: 0, creditMinor: 100, currency: 'CNY', memo: '供应商应付' }),
]);

describe('finance policy governance', () => {
  it('binds policy, affected sample and expiry into one signed preview', () => {
    const signer = new PolicyPreview('k'.repeat(32));
    const policy = financePolicy();
    const preview = signer.create(policy, sample, now);

    expect(preview.balanced).toBe(true);
    expect(() => signer.verify(preview.previewToken, { policy, sample, previewHash: preview.previewHash }, new Date(now.getTime() + 1_000))).not.toThrow();
    expect(() => signer.verify(preview.previewToken, { policy: financePolicy({ trigger: '被篡改的触发条件' }), sample, previewHash: preview.previewHash }, now)).toThrow('FINANCE_POLICY_INVALID');
    expect(() => signer.verify(preview.previewToken, { policy, sample: { ...sample, affectedCount: 18 }, previewHash: preview.previewHash }, now)).toThrow('FINANCE_POLICY_INVALID');
    expect(() => signer.verify(preview.previewToken, { policy, sample, previewHash: preview.previewHash }, new Date(now.getTime() + 11 * 60_000))).toThrow('FINANCE_POLICY_INVALID');
  });

  it('persists every required accounting policy field using optimistic versioning', async () => {
    const signer = new PolicyPreview('k'.repeat(32));
    const preview = signer.create(financePolicy(), sample, now);
    const query = vi.fn(async (_sql: string, _values?: readonly unknown[]) => result([{ id: 'financepolicy:orders', scope_id: 'enterprise:one', kind: 'accounting', rule: {}, state: 'active', version: 2 }]));
    const database = { query } as unknown as SqlExecutor;
    const scopes = { describe: vi.fn(async () => ({ scopeKind: 'enterprise', ancestors: [] })) } as unknown as FinanceScopeQuery;
    const action = policyCommands(scopes, signer, fixedClock()).policiesManage as FinanceAction;

    const response = await action(request('enterprise:one', rule(preview.previewToken, preview.previewHash)), database);

    expect(response.status).toBe(200);
    expect(query).toHaveBeenCalledTimes(1);
    const [sql, values] = query.mock.calls[0]!;
    expect(sql).toContain('id,scope_id,kind,rule,state,version,name,"trigger",entries,effective_at,expires_at,updated_at');
    expect(sql).toContain('finance.policy.version=$11');
    expect(values).toEqual(expect.arrayContaining(['financepolicy:orders', 'enterprise:one', 'accounting', 'active', '订单收入确认', '订单支付成功', sample.from, 1]));
    expect(String(values?.[3])).not.toContain('signed-policy-preview');
    expect(String(values?.[3])).not.toContain(preview.previewHash);
  });

  it('allows a mall accounting policy only when an ancestor explicitly delegates it', async () => {
    const signer = new PolicyPreview('k'.repeat(32));
    const preview = signer.create(financePolicy(), sample, now);
    const query = vi.fn()
      .mockResolvedValueOnce(result([{ allowed_kinds: ['accounting'], maximum_threshold_minor: null }]))
      .mockResolvedValueOnce(result([{ id: 'financepolicy:orders', scope_id: 'mall:one', kind: 'accounting', rule: {}, state: 'active', version: 1 }]));
    const scopes = { describe: vi.fn(async () => ({ scopeKind: 'mall', ancestors: ['enterprise:one'] })) } as unknown as FinanceScopeQuery;
    const action = policyCommands(scopes, signer, fixedClock()).policiesManage as FinanceAction;

    await expect(action(request('mall:one', rule(preview.previewToken, preview.previewHash)), { query } as unknown as SqlExecutor)).resolves.toMatchObject({ status: 200 });
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[0]?.[0]).toContain("kind='mallfinance'");
    expect(query.mock.calls[1]?.[0]).toContain('insert into finance.policy');
  });
});

function financePolicy(change: Readonly<Record<string, unknown>> = {}) {
  const value = { id: 'financepolicy:orders', name: '订单收入确认', status: 'active' as const, trigger: '订单支付成功', entries, effectiveAt: sample.from, expiresAt: null, version: 1, ...change };
  return new FinancePolicy(value.id as string, value.name as string, value.status as 'active', value.trigger as string, value.entries as typeof entries, value.effectiveAt as string, value.expiresAt as null, value.version as number);
}

function rule(previewToken: string, previewHash: string) {
  return { name: '订单收入确认', trigger: '订单支付成功', entries, effectiveAt: sample.from, expiresAt: null, targetStatus: 'active', sampleFrom: sample.from, sampleTo: sample.to, affectedCount: sample.affectedCount, previewToken, previewHash };
}

function request(scope: string, policyRule: Readonly<Record<string, unknown>>): FinanceRequest {
  const body = { kind: 'accounting', rule: policyRule };
  return {
    type: 'finance.policies.manage',
    transaction: { mode: 'write', scope, membership: 'membership:maker' } as FinanceRequest['transaction'],
    input: { path: { policyid: 'financepolicy:orders' }, query: {}, headers: {}, body, rawBody: JSON.stringify(body), deadline: Date.now() + 10_000, signal: new AbortController().signal, expectedVersion: 1 },
    security: { kind: 'session', access: { scope: { id: scope }, actor: { id: 'principal:maker' }, membership: { id: 'membership:maker' } } } as FinanceRequest['security'],
  };
}

function fixedClock(): Clock { return { now: () => new Date(now) }; }
function result(rows: readonly any[]) { return { rows, rowCount: rows.length, command: 'SELECT', oid: 0, fields: [] }; }
