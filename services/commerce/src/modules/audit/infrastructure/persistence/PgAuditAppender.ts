import type { AuditAppender, OperationAuditRecord } from '../../../../foundation/application/AuditAppender';
import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import { RedactionPolicy } from '../../domain/policy/RedactionPolicy';
import { RecordAudit } from '../../application/service/RecordAudit';
import { PgAuditRepository } from './PgAuditRepository';

export class PgAuditAppender implements AuditAppender {
  private readonly audit: RecordAudit;

  constructor(
    transactions: PgTransactionAccess,
    redaction = new RedactionPolicy()
  ) {
    this.audit = new RecordAudit(new PgAuditRepository(transactions), redaction);
  }

  append(context: WriteTransactionContext, input: OperationAuditRecord): Promise<void> {
    return this.audit.record(context, input);
  }
}
