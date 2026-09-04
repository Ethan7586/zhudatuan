import type { OperationId } from '@shop/contract';
import type { WriteTransactionContext } from '../persistence/TransactionContext';
import type { AuditOutcome, AuditReference } from './AuditSink';

export interface OperationAuditRecord {
  readonly operation: OperationId;
  readonly actor: string;
  readonly actorType: string;
  readonly scope: string;
  readonly request: string;
  readonly subject: AuditReference;
  readonly object: AuditReference;
  readonly outcome: AuditOutcome;
  readonly reason: string;
  readonly before: unknown;
  readonly after: unknown;
  readonly evidence: unknown;
  readonly trace: string;
}

export interface AuditAppender {
  append(context: WriteTransactionContext, record: OperationAuditRecord): Promise<void>;
}
