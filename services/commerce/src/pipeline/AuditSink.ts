import { token } from '../composition/Container';
import type { AuditAccessInput, AuditWriteInput } from '../platform/error/AuditEntry';
import type { WriteTransactionContext } from '../platform/database/TransactionContext';

export type { AuditAccessInput, AuditOutcome, AuditReference, AuditWriteInput } from '../platform/error/AuditEntry';

export interface AuditSink {
  record(context: WriteTransactionContext, input: AuditWriteInput): Promise<void>;
  access(context: WriteTransactionContext, input: AuditAccessInput): Promise<void>;
}

export const AUDIT_SINK = token<AuditSink>('audit.sink');
