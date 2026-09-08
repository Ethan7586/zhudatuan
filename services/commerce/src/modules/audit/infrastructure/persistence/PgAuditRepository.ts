import { createHash } from 'node:crypto';
import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { AccessRecord } from '../../domain/model/AccessRecord';
import type { AuditRecord } from '../../domain/model/AuditRecord';
import type { ArchiveBatch, ArchiveDisposal, ArchiveObject, AuditRepository } from '../../application/port/AuditRepository';
import { PgRuntimeWriter } from '../../../../platform/database/PgRuntimeWriter';

import { minuteKey, nextArchiveAt, type ArchiveRow } from './AuditRecord';
export class PgAuditRepository implements AuditRepository {
  constructor(private readonly transactions = new PgTransactionAccess()) {}

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
      `insert into audit.record(id,scope_id,actor_id,actor_type,request_id,operation,subject_type,subject_id,object_type,object_id,
      outcome,reason,before_hash,after_hash,evidence,trace_id,previous_hash,record_hash,recorded_at)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,$16,$17,$18,$19)`,
      [
        record.id,
        input.scope,
        input.actor,
        input.actorType,
        input.request,
        input.operation,
        input.subject.type,
        input.subject.id,
        input.object.type,
        input.object.id,
        input.outcome,
        input.reason,
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
      `insert into audit.accessrecord(id,scope_id,actor_id,actor_type,request_id,operation,subject_type,subject_id,object_type,
      object_id,outcome,reason,fields,trace_id,previous_hash,record_hash,accessed_at)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14,$15,$16,$17)`,
      [
        record.id,
        input.scope,
        input.actor,
        input.actorType,
        input.request,
        input.operation,
        input.subject.type,
        input.subject.id,
        input.object.type,
        input.object.id,
        input.outcome,
        input.reason,
        JSON.stringify(record.fields),
        input.trace,
        record.previousHash,
        record.recordHash,
        record.accessedAt,
      ]
    );
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

  async completeArchive(context: WriteTransactionContext, batch: ArchiveBatch, object: ArchiveObject): Promise<void> {
    const database = this.transactions.database(context);
    await database.query('select pg_advisory_xact_lock(hashtextextended($1,0))', [`audit:${batch.scope}`]);
    const retention = await database.query<{ legal_hold: boolean }>(
      `select coalesce(
      (select legal_hold from audit.retention where scope_id=$1),
      (select legal_hold from audit.retention where scope_id='organization-platform-root'),false) legal_hold`,
      [batch.scope]
    );
    if (retention.rows[0]?.legal_hold) throw new Error('AUDIT_ARCHIVE_LEGAL_HOLD_ACTIVE');
    const id = `archive:${createHash('sha256').update(`${batch.scope}:${batch.start}:${batch.end}:${batch.lastHash}`).digest('hex').slice(0, 32)}`;
    await database.query(
      `insert into audit.archiveref(id,scope_id,period_start,period_end,through_at,object_ref,sha256,object_size,key_version,
      first_record_hash,last_record_hash,record_count,expires_at,archived_at,plaintext_sha256,index_sha256,locked_until,bundle_version)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,clock_timestamp(),$14,$15,$16,2)
      on conflict(id) do nothing`,
      [
        id,
        batch.scope,
        batch.start.slice(0, 10),
        batch.end.slice(0, 10),
        batch.end,
        object.reference,
        object.sha256,
        object.size,
        object.keyVersion,
        batch.firstHash,
        batch.lastHash,
        batch.rows.length,
        object.expiresAt,
        object.plaintextHash,
        object.indexHash,
        object.lockedUntil,
      ]
    );
    const persisted = await database.query(
      `select 1 from audit.archiveref where id=$1 and scope_id=$2 and object_ref=$3 and sha256=$4
      and object_size=$5 and key_version=$6 and first_record_hash=$7 and last_record_hash=$8 and record_count=$9
      and plaintext_sha256=$10 and index_sha256=$11 and locked_until=$12 and expires_at=$13 and bundle_version=2`,
      [id, batch.scope, object.reference, object.sha256, object.size, object.keyVersion, batch.firstHash, batch.lastHash, batch.rows.length, object.plaintextHash, object.indexHash, object.lockedUntil, object.expiresAt]
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
    const expected = object.entries.map((entry) => ({ kind: entry.kind, id: entry.id, record_hash: entry.recordHash }));
    const mapped = await database.query<{ count: number; exact: boolean }>(
      `select count(*)::integer count,
      coalesce(bool_and(item.record_hash=expected.record_hash),false) exact
      from jsonb_to_recordset($2::jsonb) expected(kind text,id text,record_hash text)
      join audit.archiveitem item on item.archive_id=$1 and item.record_kind=expected.kind and item.record_id=expected.id`,
      [id, JSON.stringify(expected)]
    );
    if (mapped.rows[0]?.count !== batch.rows.length || !mapped.rows[0]?.exact) throw new Error('AUDIT_ARCHIVE_SOURCE_CHANGED');
  }

  async disposalBatch(context: ReadTransactionContext): Promise<ArchiveDisposal | null> {
    const result = await this.transactions.database(context).query<{
      archive: string;
      reference: string;
      sha256: string;
      scope: string;
    }>(`select archive.id archive,archive.object_ref reference,archive.sha256,archive.scope_id scope
      from audit.archiveref archive
      where archive.expires_at<=clock_timestamp()
        and not exists(select 1 from audit.archivedisposal disposal where disposal.archive_id=archive.id)
        and not coalesce((select legal_hold from audit.retention where scope_id=archive.scope_id),
          (select legal_hold from audit.retention where scope_id='organization-platform-root'),false)
      order by archive.expires_at,archive.id limit 1`);
    return result.rows[0] ? Object.freeze(result.rows[0]) : null;
  }

  async completeDisposal(context: WriteTransactionContext, disposal: ArchiveDisposal, trace: string): Promise<void> {
    const database = this.transactions.database(context);
    await database.query('select pg_advisory_xact_lock(hashtextextended($1,0))', [`audit:${disposal.scope}`]);
    const inserted = await database.query(
      `insert into audit.archivedisposal(archive_id,scope_id,object_ref,object_sha256,reason,trace_id,removed_at)
      select archive.id,archive.scope_id,archive.object_ref,archive.sha256,'legal-retention-expired',$5,clock_timestamp()
      from audit.archiveref archive where archive.id=$1 and archive.scope_id=$2 and archive.object_ref=$3 and archive.sha256=$4
        and archive.expires_at<=clock_timestamp()
        and not coalesce((select legal_hold from audit.retention where scope_id=archive.scope_id),
          (select legal_hold from audit.retention where scope_id='organization-platform-root'),false)
      on conflict(archive_id) do nothing`,
      [disposal.archive, disposal.scope, disposal.reference, disposal.sha256, trace]
    );
    if ((inserted.rowCount ?? 0) === 0) {
      const existing = await database.query('select 1 from audit.archivedisposal where archive_id=$1 and object_ref=$2 and object_sha256=$3', [disposal.archive, disposal.reference, disposal.sha256]);
      if (!existing.rows[0]) throw new Error('AUDIT_ARCHIVE_DISPOSAL_CONFLICT');
    }
  }

  async scheduleArchive(context: WriteTransactionContext, immediate: boolean): Promise<void> {
    const database = this.transactions.database(context);
    const next = nextArchiveAt(immediate);
    await new PgRuntimeWriter(database).schedule({ id: `job:auditarchive:${minuteKey(next)}`, kind: 'auditarchive', owner: 'audit', scope: 'organization-platform-root', payload: {}, priority: 80, availableAt: next.toISOString() });
  }
}
