import { OP_FINANCE_RECONCILIATIONS_MANAGE } from '@shop/contract/ids';
import type { OperationBodyFor, OperationId, OperationOutputFor, OperationQueryFor } from '@shop/contract';
import type { ContractJsonObject, ContractJsonValue } from '@shop/contract/schema';

export type FinanceSection = 'entries' | 'statements' | 'reconciliations' | 'settlements' | 'withdrawals' | 'invoices' | 'policies';
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

export interface FinanceFacetItem {
  readonly value: string;
  readonly label: string;
  readonly count: number;
}

export interface FinanceProviderFacet extends FinanceFacetItem {
  readonly available: boolean;
}

export interface FinanceFacetGroup<TItem extends FinanceFacetItem = FinanceFacetItem> {
  readonly items: readonly TItem[];
  readonly reason: string | null;
}

export interface FinanceFacets {
  readonly periods: FinanceFacetGroup;
  readonly providers: FinanceFacetGroup<FinanceProviderFacet>;
  readonly malls: FinanceFacetGroup;
  readonly states: FinanceFacetGroup;
  readonly differenceTypes: FinanceFacetGroup;
  readonly watermark: string | null;
}

export type FinanceAuditFactKind = OperationOutputFor<'finance.audit.read'>['facts'][number]['kind'];

export interface FinanceAuditFact {
  readonly id: string;
  readonly kind: FinanceAuditFactKind;
  readonly label: string;
  readonly businessReference: string;
  readonly state: string | null;
  readonly amountMinor: number | null;
  readonly currency: string | null;
  readonly occurredAt: string | null;
  readonly version: number | null;
}

export interface FinanceAuditEvent {
  readonly id: string;
  readonly type: string;
  readonly eventVersion: number;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly state: OperationOutputFor<'finance.audit.read'>['events'][number]['state'];
  readonly occurredAt: string;
  readonly traceId: string;
}

export interface FinanceAuditEvidence {
  readonly id: string;
  readonly kind: OperationOutputFor<'finance.audit.read'>['records'][number]['kind'];
  readonly action: string;
  readonly resourceType: string;
  readonly resourceId: string | null;
  readonly actorId: string | null;
  readonly actorType: string;
  readonly beforeHash: string | null;
  readonly afterHash: string | null;
  readonly recordHash: string;
  readonly evidence: ContractJsonValue;
  readonly occurredAt: string;
  readonly traceId: string;
}

export interface FinanceAudit {
  readonly reference: string;
  readonly facts: readonly FinanceAuditFact[];
  readonly events: readonly FinanceAuditEvent[];
  readonly records: readonly FinanceAuditEvidence[];
  readonly watermark: string | null;
}

export interface FinanceRecord {
  readonly id: string;
  readonly label: string;
  readonly reference: string;
  readonly amountMinor: number | null;
  readonly currency: string | null;
  readonly state: string;
  readonly occurredAt: string | null;
  readonly version: number | null;
  readonly facts: readonly FinanceFact[];
  readonly technicalFacts: readonly FinanceFact[];
}

export type FinanceFact =
  | Readonly<{ label: string; kind: 'text' | 'reference'; value: string | null }>
  | Readonly<{ label: string; kind: 'money'; minor: number; currency: string }>
  | Readonly<{ label: string; kind: 'time'; value: string | null }>;

export interface FinanceCommandResult {
  readonly reference: string;
  readonly state: string;
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
  readonly evidence: ContractJsonValue;
  readonly resolution?: ContractJsonValue | null;
  readonly resolvedBy?: string | null;
  readonly approvedBy?: string | null;
}

export interface FinanceReconciliation {
  readonly id: string;
  readonly scopeId: string;
  readonly provider: string;
  readonly partnerId: string;
  readonly period: string;
  readonly statementRef: string;
  readonly statementHash: string;
  readonly debitMinor: number;
  readonly creditMinor: number;
  readonly differenceMinor: number;
  readonly state: string;
  readonly evidence: ContractJsonValue;
  readonly createdBy: string;
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
  readonly period?: string;
  readonly provider?: string;
  readonly mall?: string;
  readonly state?: OperationQueryFor<'FinanceReconciliationsReadInput'>['state'];
  readonly differenceType?: string;
}
export type FinanceReconciliationAction = OperationBodyFor<'FinanceReconciliationsManageInput'>['action'];
export interface FinanceReconciliationChange {
  readonly action: FinanceReconciliationAction;
  readonly item?: string;
  readonly reason: string;
  readonly evidence?: ContractJsonObject;
}

export const financeOperations = Object.freeze({ manageReconciliation: OP_FINANCE_RECONCILIATIONS_MANAGE } satisfies Readonly<Record<string, OperationId>>);

export type FinanceColumnKey = 'channel' | 'scope' | 'matched' | 'differences' | 'channelAmount' | 'ledgerAmount' | 'differenceAmount' | 'state' | 'time';
export const defaultFinanceColumns: ReadonlySet<FinanceColumnKey> = new Set(['channel', 'scope', 'matched', 'differences', 'channelAmount', 'ledgerAmount', 'differenceAmount', 'state', 'time']);
