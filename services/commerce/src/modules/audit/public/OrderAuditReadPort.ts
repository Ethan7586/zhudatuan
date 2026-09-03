import { publicPort } from '../../../bootstrap/ModuleRegistry';
import type { ReadTransactionContext } from '../../../foundation/persistence/TransactionContext';

export interface OrderAuditEntry {
  readonly id: string;
  readonly action: string;
  readonly resourceType: string;
  readonly resourceMasked: string | null;
  readonly actorMasked: string;
  readonly occurredAt: string;
  readonly traceMasked: string;
}

export interface OrderAuditReadPort {
  timeline(context: ReadTransactionContext, scope: string, resources: readonly string[]): Promise<readonly OrderAuditEntry[]>;
}

export const ORDER_AUDIT_READ_PORT = publicPort<OrderAuditReadPort>('audit', 'orderread');
