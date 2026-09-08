import { describe, expect, it, vi } from 'vitest';
import type { SqlExecutor } from '../../../platform/database/PgTransactionAccess';
import type { ApprovalPort, ApprovalReadPort } from '../../approval/public';
import type { RepairRepository, RepairView } from '../application/port/RepairRepository';
import { RepairApproval } from '../application/service/RepairApproval';
import { RepairPolicy } from '../domain/policy/RepairPolicy';
import type { FinanceAction, FinanceRequest } from '../infrastructure/persistence/FinanceOperation';
import { repairOperations } from '../infrastructure/persistence/RepairActions';

const now = new Date('2026-09-06T08:00:00.000Z');
const entries = Object.freeze([
  Object.freeze({ account: 'expense.goods', debitMinor: 900, creditMinor: 0, currency: 'CNY', memo: '替代借方' }),
  Object.freeze({ account: 'liability.payable', debitMinor: 0, creditMinor: 900, currency: 'CNY', memo: '替代贷方' }),
]);
const differences = Object.freeze([Object.freeze({ id: 'reconciliationdifference:one', kind: 'statementbalance', expectedMinor: 900, actualMinor: 1_000, deltaMinor: 100, currency: 'CNY' })]);

describe('finance repair application flow', () => {
  it('previews using reads only and never persists transient state', async () => {
    const statement = vi.fn(async () => ({ id: 'statement:one', hash: 'a'.repeat(64), version: 3, currency: 'CNY', periodStart: '2026-09-01', periodEnd: '2026-09-30', differences }));
    const sourceJournal = vi.fn(async () => ({ id: 'journal:source', hash: 'b'.repeat(64), debitMinor: 1_000 }));
    const submit = vi.fn();
    const repository = { statement, sourceJournal, submit } as unknown as RepairRepository;
    const action = operations(repository).repairsPreview as FinanceAction;

    const result = await action(
      request('finance.reconciliationrepairs.preview', {
        statementId: 'statement:one',
        sourceJournalId: 'journal:source',
        sourceHash: 'a'.repeat(64),
        entries,
        reason: '替换错误入账',
        expectedVersion: 3,
      }),
      {} as SqlExecutor
    );

    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ repair: { status: 'draft', sourceJournalId: 'journal:source', sourceJournalHash: 'b'.repeat(64) }, balanced: true });
    expect(statement).toHaveBeenCalledTimes(1);
    expect(sourceJournal).toHaveBeenCalledTimes(1);
    expect(submit).not.toHaveBeenCalled();
  });

  it('submits exactly the proposal carried by the signed preview token', async () => {
    const policy = new RepairPolicy('k'.repeat(32));
    const proposal = {
      scopeId: 'mall:one',
      statementId: 'statement:one',
      sourceHash: 'a'.repeat(64),
      sourceVersion: 3,
      sourceJournalId: 'journal:source',
      sourceJournalHash: 'b'.repeat(64),
      sourceJournalDebitMinor: 1_000,
      entries,
      differences,
      makerId: 'membership:maker',
      reason: '替换错误入账',
    } as const;
    const preview = policy.preview(proposal, now);
    const stored = record({ id: 'reconciliationrepair:one', version: 1 });
    const submit = vi.fn(async () => stored);
    const repository = { submit } as unknown as RepairRepository;
    const approvalRequest = vi.fn(async () => ({ instanceId: 'approvalinstance:one', state: 'pending' as const, templateId: 'approvaltemplate:one', templateVersion: 1, version: 1, requestedAt: now.toISOString() }));
    const approval = new RepairApproval({ request: approvalRequest } as unknown as ApprovalPort, {} as ApprovalReadPort);
    const action = repairOperations({ scopes: async () => [], repository: () => repository, policy, approval, clock: { now: () => new Date(now) } }).repairsSubmit as FinanceAction;

    const result = await action(request('finance.reconciliationrepairs.submit', { previewToken: preview.previewToken, previewHash: preview.previewHash, expectedVersion: 3 }), {} as SqlExecutor);

    expect(result.status).toBe(201);
    expect(approvalRequest).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledWith(
      expect.objectContaining({
        previewHash: preview.previewHash,
        approvalInstanceId: 'approvalinstance:one',
        approvalAmountMinor: 1_000,
        proposal,
      })
    );
  });
});

function operations(repository: RepairRepository) {
  const policy = new RepairPolicy('k'.repeat(32));
  return repairOperations({
    scopes: async () => [],
    repository: () => repository,
    policy,
    approval: new RepairApproval({} as ApprovalPort, {} as ApprovalReadPort),
    clock: { now: () => new Date(now) },
  });
}

function request(type: FinanceRequest['type'], body: Readonly<Record<string, unknown>>): FinanceRequest {
  return {
    type,
    transaction: { mode: 'write', scope: 'mall:one', membership: 'membership:maker' } as FinanceRequest['transaction'],
    input: { path: {}, query: {}, headers: {}, body, rawBody: JSON.stringify(body), deadline: Date.now() + 10_000, signal: new AbortController().signal, expectedVersion: Number(body.expectedVersion) },
    security: { kind: 'session', access: { scope: { id: 'mall:one' }, actor: { id: 'principal:maker' }, membership: { id: 'membership:maker' } } } as FinanceRequest['security'],
  };
}

function record(value: Readonly<Record<string, unknown>>): RepairView {
  return value as RepairView;
}
