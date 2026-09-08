import type { SettlementEntry } from '../../../finance/public/SettlementReadPort';

export interface BenefitLedgerAccount {
  readonly id: string;
  readonly kind: string;
  readonly currency: string;
  readonly financeAccountId: string;
}

export function projectBenefitLedger(entries: readonly SettlementEntry[], accounts: readonly BenefitLedgerAccount[]) {
  const accountByFinance = new Map(accounts.map((account) => [account.financeAccountId, account] as const));
  return Object.freeze(
    entries.map((entry) => {
      const account = accountByFinance.get(entry.accountId);
      if (!account) throw new Error('BENEFIT_LEDGER_ACCOUNT_MISSING');
      return Object.freeze({
        id: entry.id,
        account: account.id,
        kind: account.kind,
        currency: account.currency,
        amountMinor: entry.amountMinor,
        referenceType: entry.referenceType,
        referenceId: entry.referenceId,
        description: entry.description,
        occurredAt: entry.occurredAt,
      });
    })
  );
}
