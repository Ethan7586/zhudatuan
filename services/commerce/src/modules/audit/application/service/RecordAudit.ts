import { randomUUID } from 'node:crypto';
import type { AuditAccessInput, AuditSink, AuditWriteInput } from '../../../../foundation/application/AuditSink';
import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import { AccessRecord } from '../../domain/model/AccessRecord';
import { AuditRecord } from '../../domain/model/AuditRecord';
import { RedactionPolicy } from '../../domain/policy/RedactionPolicy';
import type { AuditPort } from '../port/AuditPort';

export class RecordAudit implements AuditSink {
  constructor(
    private readonly repository: AuditPort,
    private readonly redaction = new RedactionPolicy()
  ) {}

  async record(context: WriteTransactionContext, input: AuditWriteInput): Promise<void> {
    const previous = await this.repository.previous(context, input.scope);
    const evidence = this.redaction.redact(input.evidence);
    await this.repository.appendRecord(context, new AuditRecord(`audit:${randomUUID()}`, { ...input, before: this.redaction.redact(input.before), after: this.redaction.redact(input.after) }, evidence, previous, new Date().toISOString()));
  }

  async access(context: WriteTransactionContext, input: AuditAccessInput): Promise<void> {
    const previous = await this.repository.previous(context, input.scope);
    await this.repository.appendAccess(context, new AccessRecord(`access:${randomUUID()}`, input, this.redaction.redact(input.fields), previous, new Date().toISOString()));
  }
}
