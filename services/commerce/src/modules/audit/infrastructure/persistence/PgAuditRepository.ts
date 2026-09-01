import { createHash } from 'node:crypto';
import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { AccessRecord } from '../../domain/model/AccessRecord';
import type { AuditRecord } from '../../domain/model/AuditRecord';
import type { ArchiveBatch, AuditPort } from '../../application/port/AuditPort';
import { PgRuntimeWriter } from '../../../../adapter/database/PgRuntimeWriter';

interface ArchiveRow {
  readonly id: string;
  readonly kind: 'command' | 'access';
  readonly occurred: string;
  readonly record_hash: string;
  readonly previous_hash: string | null;
  readonly payload: Readonly<Record<string, unknown>>;
}

export class PgAuditRepository implements AuditPort {
  private readonly transactions = new PgTransactionAccess();

  async previous(context: WriteTransactionContext, scope: string): Promise<string | null> {
    const database = this.transactions.database(context);
    await database.query('select pg_advisory_xact_lock(hashtextextended($1,0))', [`audit:${scope}`]);
    const result = await database.query<{ record_hash: string }>(
      `select record_hash from(
      select record_hash,recorded_at occurred from audit.record where scope_id=$1
      union all select record_hash,accessed_at from audit.accessrecord where scope_id=$1
      union all select last_record_hash,through_at from audit.archiveref where scope_id=$1) chain
      order by occurred desc limit 1`,
      [scope]
    );
    return result.rows[0]?.record_hash ?? null;
  }

  async appendRecord(context: WriteTransactionContext, record: AuditRecord): Promise<void> {
    const database = this.transactions.database(context);
    const { input } = record;
    await database.query(
      `insert into audit.record(id,scope_id,actor_id,actor_type,action,resource_type,resource_id,before_hash,after_hash,evidence,
      trace_id,previous_hash,record_hash,recorded_at) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$13,$14)`,
      [
        record.id,
        input.scope,
        input.actor,
        input.actorType,
        input.action,
        input.resourceType,
        input.resource,
        record.beforeHash,
        record.afterHash,
        JSON.stringify(record.evidence),
        input.trace,
        record.previousHash,
        record.recordHash,
        record.recordedAt,
      ]
    );
  }

  async appendAccess(context: WriteTransactionContext, record: AccessRecord): Promise<void> {
    const database = this.transactions.database(context);
    const { input } = record;
    await database.query(
      `insert into audit.accessrecord(id,scope_id,actor_id,actor_type,resource_type,resource_id,fields,purpose,trace_id,
      previous_hash,record_hash,accessed_at) values($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12)`,
      [record.id, input.scope, input.actor, input.actorType, input.resourceType, input.resource, JSON.stringify(record.fields), input.purpose, input.trace, record.previousHash, record.recordHash, record.accessedAt]
    );
  }

  async records(context: ReadTransactionContext, scope: string, cursor: Readonly<{ sort: string | null; id: string | null }>, fetch: number) {
    const database = this.transactions.database(context);
    const result = await database.query(
      `select history.id,history.kind,history.scope_id,history.actor_id,history.actor_type,history.action,
      history.resource_type,history.resource_id,history.before_hash,history.after_hash,history.evidence,history.trace_id,
      history.previous_hash,history.record_hash,history.occurred_at from(
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
    return result.rows;
  }

  async archiveBatch(context: ReadTransactionContext, limit: number): Promise<ArchiveBatch | null> {
    const database = this.transactions.database(context);
    const target = await database.query<{ scope: string; archive_years: number; hot_days: number }>(`with source as(
      select record.scope_id,min(record.recorded_at) oldest from audit.record record where not exists(
        select 1 from audit.archiveitem item where item.record_kind='command' and item.record_id=record.id) group by record.scope_id
      union all select accessrecord.scope_id,min(accessrecord.accessed_at) from audit.accessrecord accessrecord where not exists(
        select 1 from audit.archiveitem item where item.record_kind='access' and item.record_id=accessrecord.id) group by accessrecord.scope_id), candidate as(
      select source.scope_id,min(source.oldest) oldest,coalesce(exact.hot_days,root.hot_days,90) hot_days,
        coalesce(exact.archive_years,root.archive_years,7) archive_years,coalesce(exact.legal_hold,root.legal_hold,false) legal_hold
      from source left join audit.retention exact on exact.scope_id=source.scope_id
      left join audit.retention root on root.scope_id='organization-platform-root' group by source.scope_id,exact.hot_days,root.hot_days,
        exact.archive_years,root.archive_years,exact.legal_hold,root.legal_hold)
      select scope_id scope,archive_years,hot_days from candidate where not legal_hold
        and oldest<clock_timestamp()-make_interval(days=>hot_days) order by oldest,scope_id limit 1`);
    const selected = target.rows[0];
    if (!selected) return null;
    const rows = await database.query<ArchiveRow>(
      `select id,kind,to_char(occurred at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') occurred,
      record_hash,previous_hash,payload from(
        select record.id,'command' kind,record.recorded_at occurred,record.record_hash,record.previous_hash,to_jsonb(record) payload
          from audit.record record where record.scope_id=$1 and record.recorded_at<clock_timestamp()-make_interval(days=>$3)
            and not exists(select 1 from audit.archiveitem item where item.record_kind='command' and item.record_id=record.id)
        union all select accessrecord.id,'access',accessrecord.accessed_at,accessrecord.record_hash,accessrecord.previous_hash,to_jsonb(accessrecord)
          from audit.accessrecord accessrecord where accessrecord.scope_id=$1
            and accessrecord.accessed_at<clock_timestamp()-make_interval(days=>$3)
            and not exists(select 1 from audit.archiveitem item where item.record_kind='access' and item.record_id=accessrecord.id)) source
      order by occurred,id limit $2`,
      [selected.scope, limit, selected.hot_days]
    );
    if (rows.rows.length === 0) return null;
    const first = rows.rows[0]!;
    const last = rows.rows.at(-1)!;
    return Object.freeze({
      scope: selected.scope,
      start: first.occurred,
      end: last.occurred,
      firstHash: first.record_hash,
      lastHash: last.record_hash,
      rows: Object.freeze(rows.rows.map((row) => Object.freeze({ kind: row.kind, ...row.payload }))),
      recordIds: Object.freeze(rows.rows.filter(({ kind }) => kind === 'command').map(({ id }) => id)),
      accessIds: Object.freeze(rows.rows.filter(({ kind }) => kind === 'access').map(({ id }) => id)),
      archiveYears: selected.archive_years,
    });
  }

  async completeArchive(context: WriteTransactionContext, batch: ArchiveBatch, object: Readonly<{ reference: string; sha256: string; size: number; keyVersion: string; expiresAt: string }>): Promise<void> {
    const database = this.transactions.database(context);
    await database.query('select pg_advisory_xact_lock(hashtextextended($1,0))', [`audit:${batch.scope}`]);
    const id = `archive:${createHash('sha256').update(`${batch.scope}:${batch.start}:${batch.end}:${batch.lastHash}`).digest('hex').slice(0, 32)}`;
    await database.query(
      `insert into audit.archiveref(id,scope_id,period_start,period_end,through_at,object_ref,sha256,object_size,key_version,
      first_record_hash,last_record_hash,record_count,expires_at,archived_at) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,clock_timestamp())
      on conflict(id) do nothing`,
      [id, batch.scope, batch.start.slice(0, 10), batch.end.slice(0, 10), batch.end, object.reference, object.sha256, object.size, object.keyVersion, batch.firstHash, batch.lastHash, batch.rows.length, object.expiresAt]
    );
    const persisted = await database.query(
      `select 1 from audit.archiveref where id=$1 and scope_id=$2 and object_ref=$3 and sha256=$4
      and object_size=$5 and key_version=$6 and first_record_hash=$7 and last_record_hash=$8 and record_count=$9`,
      [id, batch.scope, object.reference, object.sha256, object.size, object.keyVersion, batch.firstHash, batch.lastHash, batch.rows.length]
    );
    if (!persisted.rows[0]) throw new Error('AUDIT_ARCHIVE_REFERENCE_CONFLICT');
    await database.query(
      `insert into audit.archiveitem(archive_id,record_kind,record_id,scope_id,record_hash,archived_at)
      select $1,'command',record.id,record.scope_id,record.record_hash,clock_timestamp() from audit.record record
      where record.id=any($2::text[]) and record.scope_id=$4
      union all select $1,'access',accessrecord.id,accessrecord.scope_id,accessrecord.record_hash,clock_timestamp()
      from audit.accessrecord accessrecord where accessrecord.id=any($3::text[]) and accessrecord.scope_id=$4
      on conflict(record_kind,record_id) do nothing`,
      [id, batch.recordIds, batch.accessIds, batch.scope]
    );
    const mapped = await database.query<{ count: number }>('select count(*)::integer count from audit.archiveitem where archive_id=$1', [id]);
    if (mapped.rows[0]?.count !== batch.rows.length) throw new Error('AUDIT_ARCHIVE_SOURCE_CHANGED');
  }

  async scheduleArchive(context: WriteTransactionContext, immediate: boolean): Promise<void> {
    const database = this.transactions.database(context);
    const next = nextArchiveAt(immediate);
    await new PgRuntimeWriter(database).schedule({ id: `job:auditarchive:${minuteKey(next)}`, kind: 'auditarchive', owner: 'audit', scope: 'organization-platform-root', payload: {}, priority: 80, availableAt: next.toISOString() });
  }
}

function nextArchiveAt(immediate: boolean): Date {
  const next = new Date();
  next.setUTCSeconds(0, 0);
  if (immediate) next.setUTCMinutes(next.getUTCMinutes() + 1);
  else {
    next.setUTCMinutes(0);
    next.setUTCHours(next.getUTCHours() + 1);
  }
  return next;
}

function minuteKey(value: Date): string {
  return value.toISOString().replace(/[-:T]/g, '').slice(0, 12);
}
