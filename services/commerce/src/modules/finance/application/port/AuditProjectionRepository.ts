import type { ReadTransactionContext } from '../../../../foundation/persistence/TransactionContext';

export type FinanceAuditFactKind = 'journal' | 'entry' | 'statement' | 'reconciliation' | 'settlement' | 'withdrawal' | 'invoice' | 'repair';

export interface FinanceAuditFact {
  readonly id: string;
  readonly kind: FinanceAuditFactKind;
  readonly label: string;
  readonly business_reference: string;
  readonly state: string | null;
  readonly amount_minor: number | null;
  readonly currency: string | null;
  readonly occurred_at: string | null;
  readonly version: number | null;
}

export interface FinanceAuditProjection {
  readonly facts: readonly FinanceAuditFact[];
  readonly resources: readonly string[];
}

export interface AuditProjectionRepository {
  read(context: ReadTransactionContext, scopes: readonly string[], reference: string): Promise<FinanceAuditProjection>;
}
