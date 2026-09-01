import { randomUUID } from 'node:crypto';
import type { AuditAppender, OperationAuditRecord } from '../../../../foundation/application/AuditAppender';
import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import { AuditRecord } from '../../domain/model/AuditRecord';
import { RedactionPolicy } from '../../domain/policy/RedactionPolicy';

export class PgAuditAppender implements AuditAppender {
  constructor(
    private readonly transactions: PgTransactionAccess,
    private readonly redaction = new RedactionPolicy()
  ) {}

  async append(context: WriteTransactionContext, input: OperationAuditRecord): Promise<void> {
    const database = this.transactions.database(context);
    await database.query('select pg_advisory_xact_lock(hashtextextended($1,0))', [`audit:${input.scope}`]);
    const previous = await database.query<{ record_hash: string } & Record<string, unknown>>(
      `select record_hash from(
      select record_hash,recorded_at occurred from audit.record where scope_id=$1
      union all select record_hash,accessed_at from audit.accessrecord where scope_id=$1
      union all select last_record_hash,through_at from audit.archiveref where scope_id=$1) chain
      order by occurred desc limit 1`,
      [input.scope]
    );
    const normalized = {
      scope: input.scope,
      actor: input.actor,
      actorType: input.actorType,
      action: input.operation,
      resourceType: input.resourceType,
      resource: input.resource,
      before: this.redaction.redact(input.before),
      after: this.redaction.redact(input.after),
      evidence: this.redaction.redact(input.evidence),
      trace: input.trace,
    };
    const record = new AuditRecord(`audit:${randomUUID()}`, normalized, normalized.evidence, previous.rows[0]?.record_hash ?? null, new Date().toISOString());
    await database.query(
      `insert into audit.record(id,scope_id,actor_id,actor_type,action,resource_type,resource_id,before_hash,after_hash,evidence,
      trace_id,previous_hash,record_hash,recorded_at) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$13,$14)`,
      [
        record.id,
        normalized.scope,
        normalized.actor,
        normalized.actorType,
        normalized.action,
        normalized.resourceType,
        normalized.resource,
        record.beforeHash,
        record.afterHash,
        JSON.stringify(record.evidence),
        normalized.trace,
        record.previousHash,
        record.recordHash,
        record.recordedAt,
      ]
    );
  }
}
