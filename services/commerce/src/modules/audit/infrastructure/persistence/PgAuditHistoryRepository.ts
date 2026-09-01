import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { AuditHistoryRecord, AuditHistoryRepository } from '../../application/port/AuditHistoryRepository';
interface AuditHistoryRow extends Record<string, unknown> {
  readonly id: string;
  readonly occurred_at: Date;
}
export class PgAuditHistoryRepository implements AuditHistoryRepository {
  constructor(private readonly transactions: PgTransactionAccess) {}
  async records(
    context: ReadTransactionContext,
    scope: string,
    cursor: Readonly<{
      sort: string | null;
      id: string | null;
    }>,
    fetch: number
  ): Promise<readonly AuditHistoryRecord[]> {
    const database = this.transactions.database(context);
    const result = await this.transactions.database(context).query<AuditHistoryRow>(
      `select history.id,history.kind,history.scope_id,history.actor_id,
      history.actor_type,history.action,history.resource_type,history.resource_id,history.before_hash,history.after_hash,history.evidence,
      history.trace_id,history.previous_hash,history.record_hash,history.occurred_at from(
      select record.id,'command' kind,record.scope_id,record.actor_id,record.actor_type,record.action,record.resource_type,record.resource_id,
        record.before_hash,record.after_hash,record.evidence,record.trace_id,record.previous_hash,record.record_hash,record.recorded_at occurred_at
      from audit.record record where audit.scope_allowed(record.scope_id) and not exists(
        select 1 from audit.archiveitem item where item.record_kind='command' and item.record_id=record.id)
      union all select accessrecord.id,'access',accessrecord.scope_id,accessrecord.actor_id,accessrecord.actor_type,accessrecord.purpose,
        accessrecord.resource_type,accessrecord.resource_id,null,null,accessrecord.fields,accessrecord.trace_id,accessrecord.previous_hash,
        accessrecord.record_hash,accessrecord.accessed_at from audit.accessrecord accessrecord where audit.scope_allowed(accessrecord.scope_id)
          and not exists(select 1 from audit.archiveitem item where item.record_kind='access' and item.record_id=accessrecord.id)
      union all select archive.id,'archive',archive.scope_id,null,'system','audit.archived','audit',archive.id,archive.first_record_hash,
        archive.last_record_hash,jsonb_build_object('objectRef',archive.object_ref,'count',archive.record_count,'expiresAt',archive.expires_at,
          'keyVersion',archive.key_version),archive.id,archive.first_record_hash,archive.last_record_hash,archive.archived_at
        from audit.archiveref archive where audit.scope_allowed(archive.scope_id)) history
      where $1=current_setting('app.scope_id',true) and ($2::timestamptz is null or (history.occurred_at,history.id)<($2::timestamptz,$3))
      order by history.occurred_at desc,history.id desc limit $4`,
      [scope, cursor.sort, cursor.id, fetch]
    );
    return Object.freeze(result.rows.map((row) => Object.freeze({ ...row, occurred_at: row.occurred_at.toISOString() })));
  }
}
