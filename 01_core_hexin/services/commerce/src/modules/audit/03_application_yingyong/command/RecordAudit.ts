import { randomUUID } from 'node:crypto';
import type { AuditAccessInput, AuditDatabase, AuditSink, AuditWriteInput } from '../../../../foundation/application/AuditSink';
import { AccessRecord } from '../../02_domain_yewu/model/AccessRecord';
import { AuditRecord } from '../../02_domain_yewu/model/AuditRecord';
import { RedactionPolicy } from '../../02_domain_yewu/policy/RedactionPolicy';
import type { AuditPort } from '../../01_public_gongkai/AuditPort';

export class RecordAudit implements AuditSink {
  constructor(private readonly repository: AuditPort, private readonly redaction = new RedactionPolicy()) {}

  async record(database: AuditDatabase, input: AuditWriteInput): Promise<void> {
    const previous = await this.repository.previous(database, input.scope); const evidence = this.redaction.redact(input.evidence);
    await this.repository.appendRecord(database, new AuditRecord(`audit:${randomUUID()}`, { ...input, before: this.redaction.redact(input.before),
      after: this.redaction.redact(input.after) }, evidence, previous, new Date().toISOString()));
  }

  async access(database: AuditDatabase, input: AuditAccessInput): Promise<void> {
    const previous = await this.repository.previous(database, input.scope);
    await this.repository.appendAccess(database, new AccessRecord(`access:${randomUUID()}`, input, this.redaction.redact(input.fields), previous,
      new Date().toISOString()));
  }
}
