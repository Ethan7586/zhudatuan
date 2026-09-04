import type { FinanceOperation } from './FinanceOperation';

export interface PeriodRepository {
  periodsManage: FinanceOperation<'finance.periods.manage'>;
}

export interface ReconciliationRepository {
  reconciliationsManage: FinanceOperation<'finance.reconciliations.manage'>;
}

export interface SettlementRepository {
  settlementsDecide: FinanceOperation<'finance.settlements.decide'>;
  settlementsAdjust: FinanceOperation<'finance.settlements.adjust'>;
}

export interface WithdrawalRepository {
  withdrawalsCreate: FinanceOperation<'finance.withdrawals.create'>;
  withdrawalsDecide: FinanceOperation<'finance.withdrawals.decide'>;
  withdrawalsRecover: FinanceOperation<'finance.withdrawals.recover'>;
}

export interface InvoiceProfileRepository {
  profilesManage: FinanceOperation<'invoice.profiles.manage'>;
}

export interface InvoiceRequestRepository {
  requestsCreate: FinanceOperation<'invoice.requests.create'>;
  requestsCancel: FinanceOperation<'invoice.requests.cancel'>;
  requestsDecide: FinanceOperation<'invoice.requests.decide'>;
  redInvoice: FinanceOperation<'invoice.requests.red'>;
}

export interface PolicyCommandRepository {
  policiesManage: FinanceOperation<'finance.policies.manage'>;
}
