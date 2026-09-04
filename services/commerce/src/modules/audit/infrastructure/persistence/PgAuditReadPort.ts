import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { AuditEvidence, AuditQueryReference, AuditReadPort } from '../../public/AuditReadPort';

interface AuditEvidenceRow extends Omit<AuditEvidence, 'subject' | 'object' | 'actor' | 'evidence' | 'occurredAt'> {
  readonly subjectType: string;
  readonly subjectId: string;
  readonly objectType: string;
  readonly objectId: string | null;
  readonly actorType: string;
  readonly actorId: string | null;
  readonly evidence: Readonly<Record<string, unknown>>;
  readonly occurredAt: Date;
}

export class PgAuditReadPort implements AuditReadPort {
  constructor(private readonly transactions = new PgTransactionAccess()) {}

  async records(
    context: ReadTransactionContext,
    query: Readonly<{ scopes: readonly string[]; references: readonly AuditQueryReference[]; limit?: number }>
  ): Promise<readonly AuditEvidence[]> {
    const limit = query.limit ?? 200;
    if (query.scopes.length === 0 || query.scopes.length > 1_000 || query.references.length === 0 || query.references.length > 1_000 ||
      !Number.isSafeInteger(limit) || limit < 1 || limit > 200 || query.scopes.some(invalid) || query.references.some((reference) => invalidReference(reference))) {
      throw new Error('AUDIT_REFERENCE_QUERY_INVALID');
    }
    const result = await this.transactions.database(context).query<AuditEvidenceRow>(
      `select history.id,history.kind,history.operation,history.subject_type "subjectType",history.subject_id "subjectId",
      history.object_type "objectType",history.object_id "objectId",history.actor_type "actorType",history.actor_id "actorId",
      history.request_id request,history.outcome,history.reason,history.before_hash "beforeHash",history.after_hash "afterHash",
      history.previous_hash "previousHash",history.record_hash "recordHash",history.evidence,history.occurred_at "occurredAt",
      history.trace_id trace from(
        select record.id,'command' kind,record.scope_id,record.operation,record.subject_type,record.subject_id,record.object_type,
          record.object_id,record.actor_type,record.actor_id,record.request_id,record.outcome,record.reason,record.before_hash,
          record.after_hash,record.previous_hash,record.record_hash,record.evidence,record.recorded_at occurred_at,record.trace_id
        from audit.record record where record.scope_id=any($1::text[]) and audit.scope_allowed(record.scope_id)
        union all
        select access.id,'access',access.scope_id,access.operation,access.subject_type,access.subject_id,access.object_type,
          access.object_id,access.actor_type,access.actor_id,access.request_id,access.outcome,access.reason,null,null,
          access.previous_hash,access.record_hash,access.fields,access.accessed_at,access.trace_id
        from audit.accessrecord access where access.scope_id=any($1::text[]) and audit.scope_allowed(access.scope_id)
      ) history where exists(
        select 1 from jsonb_to_recordset($2::jsonb) reference(kind text,type text,id text)
        where(reference.kind='subject' and reference.id=history.subject_id and(reference.type is null or reference.type=history.subject_type))
          or(reference.kind='object' and reference.id=history.object_id and(reference.type is null or reference.type=history.object_type))
          or(reference.kind='trace' and reference.id=history.trace_id))
      order by history.occurred_at desc,history.id desc limit $3`,
      [query.scopes, JSON.stringify(query.references), limit]
    );
    return Object.freeze(result.rows.map((row) => Object.freeze({
      id: row.id, kind: row.kind, operation: row.operation,
      subject: Object.freeze({ type: row.subjectType, id: row.subjectId }),
      object: Object.freeze({ type: row.objectType, id: row.objectId }),
      actor: Object.freeze({ type: row.actorType, id: row.actorId }),
      request: row.request, outcome: row.outcome, reason: row.reason, beforeHash: row.beforeHash, afterHash: row.afterHash,
      previousHash: row.previousHash, recordHash: row.recordHash, evidence: Object.freeze({ ...row.evidence }),
      occurredAt: row.occurredAt.toISOString(), trace: row.trace,
    })));
  }
}

function invalid(value: string): boolean { return value.length < 1 || value.length > 512 || /\s/.test(value); }
function invalidReference(reference: AuditQueryReference): boolean {
  return invalid(reference.id) || (reference.kind !== 'trace' && reference.type !== undefined && (!/^[a-z][a-z0-9.]{0,63}$/.test(reference.type)));
}
