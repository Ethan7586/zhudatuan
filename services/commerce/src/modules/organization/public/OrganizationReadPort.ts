import type { ReadTransactionContext } from '../../../foundation/persistence/TransactionContext';
import { publicPort } from '../../../bootstrap/ModuleRegistry';

export interface OrganizationReadPort {
  descendants(context: ReadTransactionContext, scopeId: string): Promise<readonly string[]>;
  activeMalls(context: ReadTransactionContext, scopeId: string): Promise<readonly string[]>;
  summaries(context: ReadTransactionContext, ids: readonly string[]): Promise<readonly OrganizationSummary[]>;
  scope(context: ReadTransactionContext, scopeId: string, lock?: boolean): Promise<OrganizationScopeSnapshot>;
}
export interface OrganizationSummary {
  readonly id: string;
  readonly name: string;
  readonly kind: string;
}
export interface OrganizationScopeSnapshot {
  readonly id: string;
  readonly scopeKind: string;
  readonly timezone: string;
  readonly tenant: string | null;
  readonly ancestors: readonly string[];
  readonly descendants: readonly string[];
}
export const ORGANIZATION_READ_PORT = publicPort<OrganizationReadPort>('organization', 'read');
