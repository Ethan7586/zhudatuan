import { publicPort } from '../../../composition/ModuleRegistry';
import type { ReadTransactionContext } from '../../../platform/database/TransactionContext';

export interface OrganizationNode {
  readonly id: string;
  readonly kind: string;
  readonly timezone: string;
  readonly tenant: string | null;
  readonly ancestors: readonly string[];
  readonly descendants: readonly string[];
}
export interface OrganizationHierarchyPort {
  descendants(context: ReadTransactionContext, scope: string): Promise<readonly string[]>;
  node(context: ReadTransactionContext, scope: string, lock?: boolean): Promise<OrganizationNode>;
}
export const ORGANIZATION_HIERARCHY_PORT = publicPort<OrganizationHierarchyPort>('organization', 'hierarchy');
