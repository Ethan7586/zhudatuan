import type { OperationId } from '@shop/contract';
import type { WriteTransactionContext } from '../persistence/TransactionContext';

export interface OperationAuditRecord {
  readonly operation: OperationId;
  readonly scope: string;
  readonly actor: string;
  readonly actorType: string;
  readonly resourceType: string;
  readonly resource: string | null;
  readonly before: unknown;
  readonly after: unknown;
  readonly evidence: unknown;
  readonly trace: string;
}

export interface AuditAppender {
  append(context: WriteTransactionContext, record: OperationAuditRecord): Promise<void>;
}
