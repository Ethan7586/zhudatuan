import type { OperationId } from '@shop/contract';
import type { WriteTransactionContext } from '../persistence/TransactionContext';
import type { AuditAppender, OperationAuditRecord } from './AuditAppender';

export class AuditDecorator {
  constructor(private readonly audit: AuditAppender) {}

  append(context: WriteTransactionContext, operation: OperationId, record: Omit<OperationAuditRecord, 'operation'>): Promise<void> {
    return this.audit.append(context, Object.freeze({ operation, ...record }));
  }
}
