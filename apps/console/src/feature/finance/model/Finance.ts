import { OP_FINANCE_RECONCILIATIONS_MANAGE } from '@shop/contract/ids';
import type { OperationId } from '@shop/contract';
import type { ContractJsonObject } from '@shop/contract/schema';

export type FinanceSection = 'entries' | 'statements' | 'reconciliations' | 'settlements' | 'withdrawals' | 'invoices';
export const FINANCE_PAGE_LIMIT = 50;

export interface FinanceCurrency {
  readonly currency: string;
  readonly balanceMinor: number;
  readonly liabilityMinor: number;
  readonly incomeMinor: number;
  readonly expenseMinor: number;
  readonly cashMinor: number;
  readonly journalCount: number;
  readonly watermark: string | null;
}

export interface FinanceOverview {
  readonly items: readonly FinanceCurrency[];
}

export interface FinanceRecord {
  readonly id: string;
  readonly label: string;
  readonly reference: string;
  readonly amountMinor: number;
  readonly currency: string;
  readonly state: string;
  readonly occurredAt: string | null;
  readonly version: number | null;
}

export interface FinanceRecordPage {
  readonly items: readonly FinanceRecord[];
  readonly count: number;
  readonly nextCursor?: string;
}

export interface FinanceReconciliationItem {
  readonly id: string;
  readonly externalMinor: number;
  readonly internalMinor: number;
  readonly differenceMinor: number;
  readonly state: string;
  readonly reasonCode?: string | null;
  readonly evidence: Readonly<Record<string, unknown>>;
  readonly resolution?: Readonly<Record<string, unknown>> | null;
  readonly resolvedBy?: string | null;
  readonly approvedBy?: string | null;
}

export interface FinanceReconciliation {
  readonly id: string;
  readonly scopeId?: string | null;
  readonly provider: string;
  readonly partnerId: string;
  readonly period: string;
  readonly statementRef?: string | null;
  readonly statementHash?: string | null;
  readonly debitMinor: number;
  readonly creditMinor: number;
  readonly differenceMinor: number;
  readonly state: string;
  readonly evidence: Readonly<Record<string, unknown>>;
  readonly approvedBy?: string | null;
  readonly updatedAt: string;
  readonly version: number;
  readonly itemCounts: Readonly<Record<string, number>>;
  readonly items: readonly FinanceReconciliationItem[];
}

export interface FinanceReconciliationPage {
  readonly items: readonly FinanceReconciliation[];
  readonly count: number;
  readonly nextCursor?: string;
}
export interface FinanceReconciliationQuery {
  readonly cursor?: string;
  readonly limit: 20 | 50;
}
export type FinanceReconciliationAction = 'retry' | 'resolve' | 'approveitem' | 'approve';
export interface FinanceReconciliationChange {
  readonly action: FinanceReconciliationAction;
  readonly item?: string;
  readonly reason: string;
  readonly evidence?: ContractJsonObject;
}

export const financeOperations = Object.freeze({ manageReconciliation: OP_FINANCE_RECONCILIATIONS_MANAGE } satisfies Readonly<Record<string, OperationId>>);

export type FinanceColumnKey = 'channel' | 'scope' | 'matched' | 'differences' | 'channelAmount' | 'ledgerAmount' | 'differenceAmount' | 'state' | 'time';
export const defaultFinanceColumns: ReadonlySet<FinanceColumnKey> = new Set(['channel', 'scope', 'matched', 'differences', 'channelAmount', 'ledgerAmount', 'differenceAmount', 'state', 'time']);
