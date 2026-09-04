import type { FinanceOperation } from './FinanceOperation';

export interface StatementProcessAdapter {
  statementsExport: FinanceOperation<'finance.statements.export'>;
  backfillsDecide: FinanceOperation<'finance.backfills.decide'>;
}

export interface InvoiceProcessAdapter {
  invoicesDownload: FinanceOperation<'finance.invoices.download'>;
}

export interface PolicyProcessAdapter {
  policiesPreview: FinanceOperation<'finance.policies.preview'>;
}

export interface RepairProcessAdapter {
  repairsPreview: FinanceOperation<'finance.reconciliationrepairs.preview'>;
  repairsSubmit: FinanceOperation<'finance.reconciliationrepairs.submit'>;
  repairsDecide: FinanceOperation<'finance.reconciliationrepairs.decide'>;
  repairsReverse: FinanceOperation<'finance.reconciliationrepairs.reverse'>;
}
