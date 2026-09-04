import { describe, expect, it } from 'vitest';
import { FINANCE_CAPABILITIES, financeManifest } from '..';

describe('finance module manifest', () => {
  it('keeps finance identity and stable public entry', () => {
    expect(financeManifest.id).toBe('finance');
    expect(financeManifest.publicEntry).toBe('./index.ts');
    expect(financeManifest.provides).toEqual([FINANCE_CAPABILITIES.read, FINANCE_CAPABILITIES.manage]);
  });

  it('declares finance dependencies, layers, and module entrypoints', () => {
    expect(financeManifest.requires).toEqual(['reporting']);
    expect(financeManifest.layers).toEqual(['public', 'domain', 'application', 'adapters', 'interface', 'tests']);
    expect(financeManifest.entrypoints.http).toEqual(['financeRoutes']);
    expect(financeManifest.entrypoints.jobs).toEqual(['reconciliation', 'settlement', 'invoice']);
  });

  it('declares finance operation list', () => {
    expect(financeManifest.operations).toEqual([
      'finance.backfills.decide',
      'finance.backfills.read',
      'finance.entries.read',
      'finance.holds.read',
      'finance.overview.read',
      'finance.policies.manage',
      'finance.periods.manage',
      'finance.periods.read',
      'finance.reconciliationrepairs.decide',
      'finance.reconciliationrepairs.preview',
      'finance.reconciliationrepairs.read',
      'finance.reconciliationrepairs.reverse',
      'finance.reconciliationrepairs.submit',
      'finance.reconciliations.manage',
      'finance.reconciliations.read',
      'finance.settlements.adjust',
      'finance.settlements.decide',
      'finance.settlements.read',
      'finance.statements.export',
      'finance.statements.read',
      'finance.withdrawals.create',
      'finance.withdrawals.decide',
      'finance.withdrawals.read',
      'finance.withdrawals.recover',
      'invoice.profiles.manage',
      'invoice.profiles.read',
      'invoice.requests.cancel',
      'invoice.requests.create',
      'invoice.requests.decide',
      'invoice.requests.read',
      'invoice.requests.red',
    ]);
  });
});
