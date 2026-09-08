import type { AuditAppender, OperationAuditRecord } from '../../../../pipeline/AuditAppender';
import type { WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import { RedactionPolicy } from '../../domain/policy/RedactionPolicy';
import { RecordAudit } from '../../application/service/RecordAudit';
import { PgAuditRepository } from './PgAuditRepository';

export class PgAuditAppender implements AuditAppender {
  private readonly audit: RecordAudit;

  constructor(transactions: PgTransactionAccess, redaction = new RedactionPolicy()) {
    this.audit = new RecordAudit(new PgAuditRepository(transactions), redaction);
  }

  append(context: WriteTransactionContext, input: OperationAuditRecord): Promise<void> {
    return this.audit.record(context, input);
  }
}
