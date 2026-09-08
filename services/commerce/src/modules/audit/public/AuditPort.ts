import { publicPort } from '../../../composition/ModuleRegistry';
import type { AuditAccessInput, AuditWriteInput } from '../../../platform/error/AuditEntry';
import type { WriteTransactionContext } from '../../../platform/database/TransactionContext';

export type AuditCommand = AuditWriteInput;
export type AuditAccessCommand = AuditAccessInput;

/** The only cross-module audit write contract. Commands are canonical facts, never formatted log lines. */
export interface AuditPort {
  record(context: WriteTransactionContext, command: AuditCommand): Promise<void>;
  access(context: WriteTransactionContext, command: AuditAccessCommand): Promise<void>;
}

export const AUDIT_PORT = publicPort<AuditPort>('audit', 'command');
