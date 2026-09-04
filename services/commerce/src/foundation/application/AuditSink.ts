import { token } from '../../bootstrap/Container';
import type { AuditAccessInput, AuditWriteInput } from '../domain/AuditEntry';
import type { WriteTransactionContext } from '../persistence/TransactionContext';

export type { AuditAccessInput, AuditOutcome, AuditReference, AuditWriteInput } from '../domain/AuditEntry';

export interface AuditSink {
  record(context: WriteTransactionContext, input: AuditWriteInput): Promise<void>;
  access(context: WriteTransactionContext, input: AuditAccessInput): Promise<void>;
}

export const AUDIT_SINK = token<AuditSink>('audit.sink');
