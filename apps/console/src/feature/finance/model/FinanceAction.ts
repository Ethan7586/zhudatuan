import type { OperationId, OperationInputFor } from '@shop/contract';
import type {
  OP_FINANCE_SETTLEMENTS_DECIDE,
  OP_FINANCE_STATEMENTS_EXPORT,
  OP_FINANCE_WITHDRAWALS_CREATE,
  OP_FINANCE_WITHDRAWALS_DECIDE,
  OP_FINANCE_WITHDRAWALS_RECOVER,
  OP_INVOICE_REQUESTS_CANCEL,
  OP_INVOICE_REQUESTS_DECIDE,
  OP_INVOICE_REQUESTS_RED,
} from '@shop/contract/ids';
import type { FinanceRecord } from './Finance';

export type FinanceActionKind =
  | 'statementexport'
  | 'settlementapprove'
  | 'settlementreject'
  | 'withdrawalcreate'
  | 'withdrawalapprove'
  | 'withdrawalreject'
  | 'withdrawalrecover'
  | 'invoicecancel'
  | 'invoiceapprove'
  | 'invoicereject'
  | 'invoicered';

export interface FinanceAction {
  readonly kind: FinanceActionKind;
  readonly label: string;
  readonly operation: OperationId;
  readonly record?: FinanceRecord;
}

export interface FinanceActionDraft {
  readonly reason: string;
  readonly proof: string;
  readonly confirmed: boolean;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly currency: string;
  readonly statementState: '' | 'draft' | 'final';
  readonly settlement: string;
  readonly amountMinor: string;
  readonly destinationRef: string;
}

export type FinanceCommand =
  | Readonly<{ operation: typeof OP_FINANCE_STATEMENTS_EXPORT; input: OperationInputFor<typeof OP_FINANCE_STATEMENTS_EXPORT>; expectedVersion: number }>
  | Readonly<{ operation: typeof OP_FINANCE_SETTLEMENTS_DECIDE; input: OperationInputFor<typeof OP_FINANCE_SETTLEMENTS_DECIDE>; expectedVersion: number }>
  | Readonly<{ operation: typeof OP_FINANCE_WITHDRAWALS_CREATE; input: OperationInputFor<typeof OP_FINANCE_WITHDRAWALS_CREATE>; expectedVersion: number }>
  | Readonly<{ operation: typeof OP_FINANCE_WITHDRAWALS_DECIDE; input: OperationInputFor<typeof OP_FINANCE_WITHDRAWALS_DECIDE>; expectedVersion: number }>
  | Readonly<{ operation: typeof OP_FINANCE_WITHDRAWALS_RECOVER; input: OperationInputFor<typeof OP_FINANCE_WITHDRAWALS_RECOVER>; expectedVersion: number }>
  | Readonly<{ operation: typeof OP_INVOICE_REQUESTS_CANCEL; input: OperationInputFor<typeof OP_INVOICE_REQUESTS_CANCEL>; expectedVersion: number }>
  | Readonly<{ operation: typeof OP_INVOICE_REQUESTS_DECIDE; input: OperationInputFor<typeof OP_INVOICE_REQUESTS_DECIDE>; expectedVersion?: number }>
  | Readonly<{ operation: typeof OP_INVOICE_REQUESTS_RED; input: OperationInputFor<typeof OP_INVOICE_REQUESTS_RED>; expectedVersion?: number }>;
