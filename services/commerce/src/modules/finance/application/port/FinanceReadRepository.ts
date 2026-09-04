import type { FinanceOperation } from './FinanceOperation';

export interface AccountReadRepository {
  overviewRead: FinanceOperation<'finance.overview.read'>;
  holdsRead: FinanceOperation<'finance.holds.read'>;
  periodsRead: FinanceOperation<'finance.periods.read'>;
}

export interface JournalReadRepository {
  entriesRead: FinanceOperation<'finance.entries.read'>;
}

export interface StatementReadRepository {
  statementsRead: FinanceOperation<'finance.statements.read'>;
  backfillsRead: FinanceOperation<'finance.backfills.read'>;
}

export interface ReconciliationReadRepository {
  reconciliationsRead: FinanceOperation<'finance.reconciliations.read'>;
}

export interface SettlementReadRepository {
  settlementsRead: FinanceOperation<'finance.settlements.read'>;
}

export interface WithdrawalReadRepository {
  withdrawalsRead: FinanceOperation<'finance.withdrawals.read'>;
}

export interface InvoiceReadRepository {
  invoicesRead: FinanceOperation<'finance.invoices.read'>;
  profilesRead: FinanceOperation<'invoice.profiles.read'>;
  requestsRead: FinanceOperation<'invoice.requests.read'>;
}

export interface PolicyReadRepository {
  policiesRead: FinanceOperation<'finance.policies.read'>;
}

export interface RepairReadRepository {
  repairsRead: FinanceOperation<'finance.reconciliationrepairs.read'>;
}
