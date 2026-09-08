import type { OperationOutputFor } from '@shop/contract';
import type { ContractJsonValue } from '@shop/contract/schema';

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
