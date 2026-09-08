import { randomUUID } from 'node:crypto';
import type { AuditAccessInput, AuditSink, AuditWriteInput } from '../../../../pipeline/AuditSink';
import type { WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import { AccessRecord } from '../../domain/model/AccessRecord';
import { AuditRecord } from '../../domain/model/AuditRecord';
import { RedactionPolicy } from '../../domain/policy/RedactionPolicy';
import type { AuditRepository } from '../port/AuditRepository';

export class RecordAudit implements AuditSink {
  constructor(
    private readonly repository: AuditRepository,
    private readonly redaction = new RedactionPolicy()
  ) {}

  async record(context: WriteTransactionContext, input: AuditWriteInput): Promise<void> {
    const previous = await this.repository.previous(context, input.scope);
    const evidence = this.redaction.redact(input.evidence);
    const normalized = Object.freeze({ ...input, reason: this.reason(input.reason), before: this.redaction.redact(input.before), after: this.redaction.redact(input.after), evidence });
    await this.repository.appendRecord(context, new AuditRecord(`audit:${randomUUID()}`, normalized, evidence, previous, new Date().toISOString()));
  }

  async access(context: WriteTransactionContext, input: AuditAccessInput): Promise<void> {
    const previous = await this.repository.previous(context, input.scope);
    const fields = this.redaction.redact(input.fields);
    await this.repository.appendAccess(context, new AccessRecord(`access:${randomUUID()}`, Object.freeze({ ...input, reason: this.reason(input.reason), fields }), fields, previous, new Date().toISOString()));
  }

  private reason(value: string): string {
    const redacted = this.redaction.redact({ reason: value }) as Readonly<{ reason: string }>;
    return redacted.reason;
  }
}
