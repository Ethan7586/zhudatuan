import { operationSchema } from '@shop/contract';
import {
  OP_FINANCE_ENTRIES_READ,
  OP_FINANCE_POLICIES_READ,
  OP_FINANCE_RECONCILIATIONS_READ,
  OP_FINANCE_SETTLEMENTS_READ,
  OP_FINANCE_STATEMENTS_READ,
  OP_FINANCE_WITHDRAWALS_READ,
  OP_INVOICE_REQUESTS_READ,
} from '@shop/contract/ids';

export const EntryPageSchema = operationSchema(OP_FINANCE_ENTRIES_READ).output;
export const StatementPageSchema = operationSchema(OP_FINANCE_STATEMENTS_READ).output;
export const ReconciliationPageSchema = operationSchema(OP_FINANCE_RECONCILIATIONS_READ).output;
export const SettlementPageSchema = operationSchema(OP_FINANCE_SETTLEMENTS_READ).output;
export const WithdrawalPageSchema = operationSchema(OP_FINANCE_WITHDRAWALS_READ).output;
export const InvoicePageSchema = operationSchema(OP_INVOICE_REQUESTS_READ).output;
export const PolicyPageSchema = operationSchema(OP_FINANCE_POLICIES_READ).output;
