import { describe, expect, it } from 'vitest';
import { canonicalFinancialActionRequest, requiresFinancialActionProof, requiresFinancialExpectedVersion } from './FinancialActionPolicy';

describe('FinancialActionPolicy', () => {
  it('requires a proof only for explicitly gated finance and invoice writes', () => {
    expect(requiresFinancialActionProof('finance.settlements.decide')).toBe(true);
    expect(requiresFinancialActionProof('finance.reconciliationrepairs.submit')).toBe(true);
    expect(requiresFinancialActionProof('finance.reconciliationrepairs.decide')).toBe(true);
    expect(requiresFinancialActionProof('finance.reconciliationrepairs.reverse')).toBe(true);
    expect(requiresFinancialActionProof('referral.settings.manage')).toBe(true);
    expect(requiresFinancialActionProof('referral.products.manage')).toBe(true);
    expect(requiresFinancialActionProof('referral.withdrawals.create')).toBe(true);
    expect(requiresFinancialActionProof('finance.reconciliationrepairs.preview')).toBe(false);
    expect(requiresFinancialActionProof('finance.policies.preview')).toBe(false);
    expect(requiresFinancialActionProof('finance.policies.manage')).toBe(true);
    expect(requiresFinancialActionProof('invoice.requests.decide')).toBe(true);
    expect(requiresFinancialActionProof('finance.settlements.read')).toBe(false);
    expect(requiresFinancialActionProof('order.orders.create')).toBe(false);
  });

  it('requires optimistic concurrency on every financial resource mutation', () => {
    expect(requiresFinancialExpectedVersion('finance.reconciliationrepairs.preview')).toBe(true);
    expect(requiresFinancialExpectedVersion('finance.reconciliationrepairs.submit')).toBe(true);
    expect(requiresFinancialExpectedVersion('finance.reconciliationrepairs.decide')).toBe(true);
    expect(requiresFinancialExpectedVersion('finance.reconciliationrepairs.reverse')).toBe(true);
    expect(requiresFinancialExpectedVersion('finance.policies.preview')).toBe(true);
    expect(requiresFinancialExpectedVersion('finance.withdrawals.create')).toBe(true);
    expect(requiresFinancialExpectedVersion('invoice.profiles.manage')).toBe(true);
    expect(requiresFinancialExpectedVersion('invoice.requests.create')).toBe(true);
    expect(requiresFinancialExpectedVersion('finance.statements.export')).toBe(false);
  });

  it('canonicalizes the exact operation, path, query and JSON body for proof binding', () => {
    const first = canonicalFinancialActionRequest({
      operation: 'finance.settlements.decide',
      path: { settlementid: 'settlement:one' },
      query: { status: ['open', 'review'], page: 2, ignored: null },
      body: { reason: 'verified', decision: 'approved', evidence: { z: 2, a: 1 } },
    });
    const reordered = canonicalFinancialActionRequest({
      operation: 'finance.settlements.decide',
      path: { settlementid: 'settlement:one' },
      query: { page: '2', ignored: undefined, status: ['open', 'review'] },
      body: { evidence: { a: 1, z: 2 }, decision: 'approved', reason: 'verified' },
    });

    expect(first).toBe(reordered);
    expect(first).toBe('{"operation":"finance.settlements.decide","path":{"settlementid":"settlement:one"},"query":{"page":"2","status":["open","review"]},"body":{"decision":"approved","evidence":{"a":1,"z":2},"reason":"verified"}}');
  });

  it('fails closed for non-financial operations and malformed request material', () => {
    expect(() => canonicalFinancialActionRequest({ operation: 'order.orders.create' })).toThrow('FINANCIAL_ACTION_REQUEST_INVALID');
    expect(() =>
      canonicalFinancialActionRequest({
        operation: 'finance.settlements.decide',
        path: { settlementid: '' },
      })
    ).toThrow('FINANCIAL_ACTION_REQUEST_INVALID');
  });
});
