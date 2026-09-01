import type { OperationId, OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { ExecutionContext } from '../../../../foundation/application/HandlerContext';
import type { OperationReply } from '../../../../foundation/application/OperationHandler';
import type { ReadTransactionContext } from '../../../../foundation/persistence/TransactionContext';

export type FinanceRepositoryMethod<TKey extends OperationId> = (transaction: ReadTransactionContext, input: OperationInputFor<TKey>, context: ExecutionContext<TKey>) => Promise<OperationReply<OperationOutputFor<TKey>>>;

export interface AccountRepository {
  overviewRead: FinanceRepositoryMethod<'finance.overview.read'>;
  holdsRead: FinanceRepositoryMethod<'finance.holds.read'>;
  periodsRead: FinanceRepositoryMethod<'finance.periods.read'>;
  periodsManage: FinanceRepositoryMethod<'finance.periods.manage'>;
}

export interface JournalRepository {
  entriesRead: FinanceRepositoryMethod<'finance.entries.read'>;
}

export interface StatementRepository {
  statementsRead: FinanceRepositoryMethod<'finance.statements.read'>;
  statementsExport: FinanceRepositoryMethod<'finance.statements.export'>;
  reconciliationsManage: FinanceRepositoryMethod<'finance.reconciliations.manage'>;
  reconciliationsRead: FinanceRepositoryMethod<'finance.reconciliations.read'>;
  backfillsRead: FinanceRepositoryMethod<'finance.backfills.read'>;
  backfillsDecide: FinanceRepositoryMethod<'finance.backfills.decide'>;
}

export interface SettlementRepository {
  settlementsRead: FinanceRepositoryMethod<'finance.settlements.read'>;
  settlementsDecide: FinanceRepositoryMethod<'finance.settlements.decide'>;
  settlementsAdjust: FinanceRepositoryMethod<'finance.settlements.adjust'>;
  withdrawalsRead: FinanceRepositoryMethod<'finance.withdrawals.read'>;
  withdrawalsCreate: FinanceRepositoryMethod<'finance.withdrawals.create'>;
  withdrawalsDecide: FinanceRepositoryMethod<'finance.withdrawals.decide'>;
  withdrawalsRecover: FinanceRepositoryMethod<'finance.withdrawals.recover'>;
}

export interface PolicyRepository {
  policiesRead: FinanceRepositoryMethod<'finance.policies.read'>;
  policiesPreview: FinanceRepositoryMethod<'finance.policies.preview'>;
  policiesManage: FinanceRepositoryMethod<'finance.policies.manage'>;
}

export interface RepairRepository {
  repairsRead: FinanceRepositoryMethod<'finance.reconciliationrepairs.read'>;
  repairsPreview: FinanceRepositoryMethod<'finance.reconciliationrepairs.preview'>;
  repairsSubmit: FinanceRepositoryMethod<'finance.reconciliationrepairs.submit'>;
  repairsDecide: FinanceRepositoryMethod<'finance.reconciliationrepairs.decide'>;
  repairsReverse: FinanceRepositoryMethod<'finance.reconciliationrepairs.reverse'>;
}

export interface InvoiceRepository {
  invoicesRead: FinanceRepositoryMethod<'finance.invoices.read'>;
  invoicesDownload: FinanceRepositoryMethod<'finance.invoices.download'>;
  profilesManage: FinanceRepositoryMethod<'invoice.profiles.manage'>;
  profilesRead: FinanceRepositoryMethod<'invoice.profiles.read'>;
  requestsCreate: FinanceRepositoryMethod<'invoice.requests.create'>;
  requestsRead: FinanceRepositoryMethod<'invoice.requests.read'>;
  requestsCancel: FinanceRepositoryMethod<'invoice.requests.cancel'>;
  requestsDecide: FinanceRepositoryMethod<'invoice.requests.decide'>;
  redInvoice: FinanceRepositoryMethod<'invoice.requests.red'>;
}
