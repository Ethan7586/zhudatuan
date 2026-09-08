import { describe, expect, it, vi } from 'vitest';
import type { ApprovalPort } from '../../approval/public';
import { result, transactionManager } from '../../../test/TransactionFixture';
import type { ReconciliationProcess, ReconciliationOutcome } from '../application/port/ReconciliationProcess';
import type { ReconciliationReviewPort } from '../application/port/ReconciliationReviewPort';
import { ReconcileFinance } from '../application/process/ReconcileFinance';
import { ReconciliationPolicy } from '../domain/policy/ReconciliationPolicy';
import { PgReconciliationReview } from '../infrastructure/persistence/PgReconciliationReview';

const base: ReconciliationOutcome = Object.freeze({
  id: 'reconciliation:one',
  scopeId: 'mall:one',
  makerId: 'membership:maker',
  statementHash: 'a'.repeat(64),
  externalMinor: 10_050,
  internalMinor: 10_000,
  differenceMinor: 50,
  differenceCount: 1,
  maximumDifferenceMinor: 50,
  thresholdMinor: 100,
  version: 2,
  state: 'difference',
});

describe('finance reconciliation routing', () => {
  it('routes a bounded difference automatically and a larger single item to Approval', async () => {
    const route = vi.fn<ReconciliationReviewPort['route']>(async () => undefined);
    const reconcile = vi.fn<ReconciliationProcess['reconcile']>(async () => base);
    const process = new ReconcileFinance({ reconcile, post: vi.fn() }, { route });
    const signal = new AbortController().signal;

    await process.execute(base.id, base.scopeId, signal, 123);
    expect(route).toHaveBeenCalledWith(base, 'automatic', signal, 123);

    reconcile.mockResolvedValueOnce({ ...base, maximumDifferenceMinor: 101 });
    await process.execute(base.id, base.scopeId, signal, 124);
    expect(route).toHaveBeenLastCalledWith(expect.objectContaining({ maximumDifferenceMinor: 101 }), 'approval', signal, 124);
  });

  it('uses zero as the fail-closed default and rejects malformed threshold configuration', () => {
    const policy = new ReconciliationPolicy();
    expect(policy.threshold(undefined)).toBe(0);
    expect(policy.route({ ...base, thresholdMinor: 0 })).toBe('approval');
    expect(() => policy.threshold({ amountMinor: -1 })).toThrowError(/VALIDATION_FAILED/);
    expect(() => policy.threshold({ amountMinor: 1.5 })).toThrowError(/VALIDATION_FAILED/);
  });

  it('resolves only reconciliation rows for an automatic route and never writes the Ledger', async () => {
    const sql: string[] = [];
    const query = vi.fn(async (text: string) => {
      sql.push(text.replace(/\s+/g, ' ').trim());
      if (text.includes('for update')) return result([{ state: 'difference', version: 2, approval_instance_id: null }]);
      return result([{ id: base.id }]);
    });
    const request = vi.fn();
    const review = new PgReconciliationReview(transactionManager(query), { request } as unknown as ApprovalPort);

    await review.route(base, 'automatic', new AbortController().signal, Date.now() + 10_000);

    expect(request).not.toHaveBeenCalled();
    expect(sql.some((statement) => /finance\.(journal|entry|account)/.test(statement))).toBe(false);
    expect(sql.some((statement) => statement.includes("review_route='automatic'"))).toBe(true);
  });

  it('creates an immutable Approval binding for an out-of-threshold difference without changing accounts', async () => {
    const sql: string[] = [];
    const query = vi.fn(async (text: string) => {
      sql.push(text.replace(/\s+/g, ' ').trim());
      if (text.includes('for update')) return result([{ state: 'difference', version: 2, approval_instance_id: null }]);
      return result([{ id: base.id }]);
    });
    const request = vi.fn(async () => ({ instanceId: 'approvalinstance:one', state: 'pending' as const, templateId: 'approvaltemplate:one', templateVersion: 1, version: 1, requestedAt: '2026-09-06T00:00:00.000Z' }));
    const review = new PgReconciliationReview(transactionManager(query), { request } as unknown as ApprovalPort);

    await review.route({ ...base, thresholdMinor: 10 }, 'approval', new AbortController().signal, Date.now() + 10_000);

    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({ membership: 'membership:maker' }),
      expect.objectContaining({
        requesterId: 'membership:maker',
        subject: expect.objectContaining({ kind: 'reconciliation', id: base.id, version: base.version }),
        action: 'finance.reconciliation.review',
        amountMinor: 50,
        currency: 'CNY',
      })
    );
    expect(sql.some((statement) => /finance\.(journal|entry|account)/.test(statement))).toBe(false);
    expect(sql.some((statement) => statement.includes("review_route='approval'"))).toBe(true);
  });
});
