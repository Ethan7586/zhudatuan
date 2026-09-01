import { PgTransactionAccess, type SqlExecutor } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import { createHash, randomUUID } from 'node:crypto';
import type { DirectoryRepository, DirectoryCounts, StagedSubject, CurrentDirectorySubject, DirectoryApplyKind, DirectoryDeparture } from '../../application/port/DirectoryRepository';
import type { DirectoryPage } from '../../application/port/DirectoryProvider';
import { DirectoryConnection, type DirectoryConnectionValue } from '../../domain/model/DirectoryConnection';
import type { SyncRun, SyncMode } from '../../domain/model/SyncRun';
import { DirectorySubject } from '../../domain/model/DirectorySubject';
import { DirectoryMembership } from '../../domain/model/DirectoryMembership';
import { mapConnection, mapRun, type ConnectionRow, type ConnectionSummaryRow, type RunRow, type RunSummaryRow } from './DirectoryRecord';
import { writeDirectoryOrganization } from './DirectoryOrganizationWriter';
export class PgDirectoryRepository implements DirectoryRepository {
  private readonly transactions = new PgTransactionAccess();
  async list(context: ReadTransactionContext, scope: string, after: string | null, limit: number) {
    const database = this.transactions.database(context);
    const result = await database.query<ConnectionSummaryRow>(
      `select connection.id,connection.organization_id,connection.provider_type type,connection.status,connection.successful_version,
      connection.version,connection.updated_at,(select max(completed_at) from organization.syncrun run where run.connection_id=connection.id and run.state='completed') last_success_at
      from organization.directoryconnection connection where connection.provider_status='enabled'
      and exists(select 1 from organization.unitclosure closure where closure.ancestor_id=$1 and closure.descendant_id=connection.organization_id)
      and ($2::uuid is null or connection.id>$2) order by connection.id limit $3`,
      [scope, after, limit]
    );
    return Object.freeze(
      result.rows.map((row) =>
        Object.freeze({ ...row, successful_version: Number(row.successful_version), version: Number(row.version), updated_at: row.updated_at.toISOString(), last_success_at: row.last_success_at?.toISOString() ?? null })
      )
    );
  }
  async require(context: ReadTransactionContext, id: string): Promise<DirectoryConnection> {
    return this.load(this.transactions.database(context), id, false);
  }
  async lock(context: WriteTransactionContext, id: string): Promise<DirectoryConnection> {
    return this.load(this.transactions.database(context), id, true);
  }
  private async load(database: SqlExecutor, id: string, lock: boolean): Promise<DirectoryConnection> {
    const result = await database.query<ConnectionRow>(
      `select connection.id,connection.tenant_id,connection.organization_id,connection.provider_instance_id,
      connection.provider_type,connection.secret_ref,connection.cursor_ciphertext,connection.successful_version,connection.status,connection.version
      from organization.directoryconnection connection
      where connection.id=$1${lock ? ' for update' : ''}`,
      [id]
    );
    const row = result.rows[0];
    if (!row) throw new Error('DIRECTORY_NOT_FOUND');
    return mapConnection(row);
  }
  async requireWebhook(context: ReadTransactionContext, id: string): Promise<DirectoryConnection> {
    const database = this.transactions.database(context);
    const result = await database.query<ConnectionRow>(
      `select id,tenant_id,organization_id,provider_instance_id,provider_type,secret_ref,
      cursor_ciphertext,successful_version,status,version from organization.webhook_directory($1)`,
      [id]
    );
    const row = result.rows[0];
    if (!row) throw new Error('DIRECTORY_NOT_FOUND');
    return mapConnection(row);
  }
  async save(context: WriteTransactionContext, value: DirectoryConnectionValue, expected: number): Promise<DirectoryConnection> {
    const database = this.transactions.database(context);
    const validated = new DirectoryConnection(value);
    const result = await database.query<ConnectionRow>(
      `insert into organization.directoryconnection(
      id,tenant_id,organization_id,provider_instance_id,provider_type,provider_status,secret_ref,status,version,created_at,updated_at)
      values($1,$2,$3,$4,$5,'enabled',$6,$7,0,clock_timestamp(),clock_timestamp())
      on conflict(id) do update set organization_id=excluded.organization_id,provider_instance_id=excluded.provider_instance_id,
      provider_type=excluded.provider_type,provider_status=excluded.provider_status,secret_ref=excluded.secret_ref,status=excluded.status,
      version=organization.directoryconnection.version+1,updated_at=clock_timestamp()
      where organization.directoryconnection.tenant_id=excluded.tenant_id and organization.directoryconnection.version=$8
      returning id,tenant_id,organization_id,provider_instance_id,provider_type,secret_ref,cursor_ciphertext,successful_version,status,version`,
      [validated.id, validated.tenantid, validated.organizationid, validated.providerid, validated.providertype, validated.secretref, validated.status, expected]
    );
    const row = result.rows[0];
    if (!row) throw new Error('EXPECTED_VERSION_MISMATCH');
    return mapConnection(row);
  }
  async runs(context: ReadTransactionContext, connection: string, after: string | null, limit: number) {
    const database = this.transactions.database(context);
    const result = await database.query<RunSummaryRow>(
      `select id,mode,state,read_count,applied_count,conflict_count,ignored_count,watermark,started_at,completed_at,created_at
      from organization.syncrun where connection_id=$1 and ($2::uuid is null or id<$2) order by created_at desc,id desc limit $3`,
      [connection, after, limit]
    );
    return Object.freeze(
      result.rows.map((row) =>
        Object.freeze({
          ...row,
          read_count: Number(row.read_count),
          applied_count: Number(row.applied_count),
          conflict_count: Number(row.conflict_count),
          ignored_count: Number(row.ignored_count),
          watermark: row.watermark?.toISOString() ?? null,
          started_at: row.started_at?.toISOString() ?? null,
          completed_at: row.completed_at?.toISOString() ?? null,
          created_at: row.created_at.toISOString(),
        })
      )
    );
  }
  async createRun(context: WriteTransactionContext, connection: string, mode: SyncMode, key: string): Promise<SyncRun> {
    const database = this.transactions.database(context);
    const id = randomUUID();
    const result = await database.query<RunRow>(
      `insert into organization.syncrun(id,connection_id,provider_run_id,mode,state,cursor_ciphertext,created_at)
      select $1,connection.id,$3,$4,'queued',case when $4='incremental' then connection.cursor_ciphertext else null end,clock_timestamp()
      from organization.directoryconnection connection where connection.id=$2
      on conflict(connection_id,provider_run_id) do update set provider_run_id=excluded.provider_run_id
      returning id,connection_id,provider_run_id,mode,state,cursor_ciphertext,read_count,applied_count,conflict_count,ignored_count`,
      [id, connection, key, mode]
    );
    const row = result.rows[0];
    if (!row) throw new Error('DIRECTORY_SYNC_CREATE_FAILED');
    return mapRun(row);
  }
  async startRun(context: WriteTransactionContext, run: string): Promise<SyncRun> {
    const database = this.transactions.database(context);
    const result = await database.query<RunRow>(
      `update organization.syncrun set state='running',started_at=coalesce(started_at,clock_timestamp())
      where id=$1 and state in('queued','running') returning id,connection_id,provider_run_id,mode,state,cursor_ciphertext,read_count,applied_count,conflict_count,ignored_count`,
      [run]
    );
    const row = result.rows[0];
    if (!row) throw new Error('DIRECTORY_SYNC_STATE_INVALID');
    return mapRun(row);
  }
  async event(
    context: ReadTransactionContext,
    run: string
  ): Promise<
    Readonly<{
      eventid: string;
      envelope: string;
    }>
  > {
    const database = this.transactions.database(context);
    const result = await database.query<{
      eventid: string;
      envelope: string;
    }>(
      `select inbox.provider_event_id eventid,inbox.envelope_ciphertext envelope
      from organization.syncrun run join organization.directoryinbox inbox on inbox.connection_id=run.connection_id
        and run.provider_run_id='event:'||inbox.provider_event_id where run.id=$1 and run.mode='event' and inbox.state='received'`,
      [run]
    );
    const row = result.rows[0];
    if (!row || !row.envelope) throw new Error('DIRECTORY_EVENT_NOT_FOUND');
    return Object.freeze(row);
  }
  async stage(context: WriteTransactionContext, run: SyncRun, page: DirectoryPage, subjects: readonly StagedSubject[]): Promise<boolean> {
    const database = this.transactions.database(context);
    const projection = subjects.map((item) => ({ hash: item.hash.toString('hex'), status: item.status, type: item.type, version: item.sourceversion }));
    const hash = createHash('sha256').update(JSON.stringify(projection)).digest('hex');
    const result = await database.query(
      `insert into organization.directoryinbox(connection_id,provider_event_id,provider_version,body_hash,state,received_at,processed_at)
      values($1,$2,$3,$4,'processed',clock_timestamp(),clock_timestamp()) on conflict do nothing returning provider_event_id`,
      [run.connectionid, page.eventid, page.version, hash]
    );
    return result.rowCount === 1;
  }
  async current(context: ReadTransactionContext, connection: string, hashes: readonly Buffer[]): Promise<ReadonlyMap<string, CurrentDirectorySubject>> {
    const database = this.transactions.database(context);
    if (hashes.length === 0) return new Map();
    const result = await database.query<{
      hash: string;
      id: string;
      status: string;
      sourceversion: number;
      missingcount: number;
      membership: string | null;
    }>(
      `select encode(subject.subject_hash,'hex') hash,subject.id,subject.status,subject.source_version sourceversion,subject.missing_count missingcount,
        (select membership.membership_id from organization.directorymembership membership where membership.subject_id=subject.id and membership.membership_id is not null order by membership.version desc limit 1) membership
       from organization.directorysubject subject where subject.connection_id=$1 and subject.subject_hash=any($2::bytea[])`,
      [connection, hashes]
    );
    return new Map(result.rows.map((row) => [row.hash, Object.freeze(row)]));
  }
  async apply(context: WriteTransactionContext, connection: DirectoryConnection, subject: StagedSubject, kind: DirectoryApplyKind): Promise<void> {
    const database = this.transactions.database(context);
    if (subject.type === 'department') await writeDirectoryOrganization(database, connection, subject);
    const stored = kind === 'conflict' ? 'conflict' : subject.status;
    const entity = new DirectorySubject({ id: subject.id, connectionid: connection.id, hash: subject.hash, type: subject.type, status: stored, attributes: subject.attributes, sourceversion: subject.sourceversion, version: 0 });
    await database.query(
      `insert into organization.directorysubject(id,connection_id,subject_hash,type,status,attributes_ciphertext,source_version,missing_count,version)
      values($1,$2,$3,$4,$5,$6,$7,0,0) on conflict(connection_id,subject_hash) do update set status=excluded.status,
      attributes_ciphertext=excluded.attributes_ciphertext,source_version=excluded.source_version,missing_count=0,version=organization.directorysubject.version+1,
      last_seen_at=clock_timestamp() where organization.directorysubject.source_version<=excluded.source_version`,
      [entity.id, entity.connectionid, entity.hash, entity.type, entity.status, entity.attributes, entity.sourceversion]
    );
    if (subject.type === 'user') {
      await database.query(
        `update organization.directorymembership set status='inactive',version=version+1
        where connection_id=$1 and subject_id=$2 and organization_id<>$3 and status='active'`,
        [connection.id, subject.id, subject.organization]
      );
      const membership = new DirectoryMembership({
        id: subject.id,
        connectionid: connection.id,
        subjectid: subject.id,
        organizationid: subject.organization,
        membershipid: subject.membership,
        status: kind === 'conflict' ? 'conflict' : subject.membership === null ? 'pending' : subject.status === 'active' ? 'active' : 'inactive',
        effectiveat: new Date().toISOString(),
        expiresat: null,
        sourceversion: subject.sourceversion,
        version: 0,
      });
      await database.query(
        `insert into organization.directorymembership(id,connection_id,subject_id,organization_id,membership_id,status,effective_at,source_version,version)
        values($1,$2,$3,$4,$5,$6,clock_timestamp(),$7,0) on conflict(connection_id,subject_id,organization_id) do update set
        membership_id=coalesce(organization.directorymembership.membership_id,excluded.membership_id),status=excluded.status,
        source_version=excluded.source_version,version=organization.directorymembership.version+1
        where organization.directorymembership.source_version<=excluded.source_version`,
        [membership.id, membership.connectionid, membership.subjectid, membership.organizationid, membership.membershipid, membership.status, membership.sourceversion]
      );
    }
  }
  async advance(context: WriteTransactionContext, run: string, page: DirectoryPage, counts: DirectoryCounts): Promise<void> {
    const database = this.transactions.database(context);
    await database.query(
      `update organization.syncrun set cursor_ciphertext=$2,read_count=read_count+$3,applied_count=applied_count+$4,
      conflict_count=conflict_count+$5,ignored_count=ignored_count+$6,watermark=clock_timestamp(),
      checksum=encode(public.digest(coalesce(checksum,'')||$7||':'||$8::text,'sha256'),'hex') where id=$1 and state='running'`,
      [run, page.cursor, counts.read, counts.applied, counts.conflicts, counts.ignored, page.eventid, page.version]
    );
  }
  async complete(context: WriteTransactionContext, run: string, connection: string, version: number, cursor: string | null): Promise<void> {
    const database = this.transactions.database(context);
    const result = await database.query<{
      started_at: Date;
      mode: SyncMode;
    }>(
      `update organization.syncrun set state='completed',completed_at=clock_timestamp(),watermark=clock_timestamp()
      where id=$1 and state='running' and checksum is not null returning started_at,mode`,
      [run]
    );
    const completed = result.rows[0];
    if (!completed) throw new Error('DIRECTORY_SYNC_STATE_INVALID');
    if (completed.mode === 'full')
      await database.query(
        `update organization.directorysubject set missing_count=least(2,missing_count+1),version=version+1
      where connection_id=$1 and last_seen_at<$2 and status not in('deleted','conflict')`,
        [connection, completed.started_at]
      );
    await database.query(
      `update organization.directoryconnection set successful_version=greatest(successful_version,$2),cursor_ciphertext=$3,
      version=version+1,updated_at=clock_timestamp() where id=$1`,
      [connection, version, cursor]
    );
  }
  async departures(context: ReadTransactionContext, connection: string): Promise<readonly DirectoryDeparture[]> {
    const database = this.transactions.database(context);
    const result = await database.query<DirectoryDeparture>(
      `select subject.id subject,membership.membership_id membership,membership.organization_id organization
      from organization.directorysubject subject join organization.directorymembership membership on membership.subject_id=subject.id
      where subject.connection_id=$1 and subject.type='user' and subject.missing_count>=2 and subject.status='active'
        and membership.membership_id is not null and membership.status='active' order by subject.id limit 1000`,
      [connection]
    );
    return Object.freeze(result.rows.map((row) => Object.freeze(row)));
  }
  async freeze(context: WriteTransactionContext, connection: string, subject: string): Promise<void> {
    const database = this.transactions.database(context);
    await database.query(`update organization.directorysubject set status='inactive',version=version+1 where id=$1 and connection_id=$2 and status='active'`, [subject, connection]);
    await database.query(`update organization.directorymembership set status='inactive',version=version+1 where subject_id=$1 and connection_id=$2 and status='active'`, [subject, connection]);
  }
  async fail(context: WriteTransactionContext, run: string, code: string): Promise<void> {
    const database = this.transactions.database(context);
    await database.query(
      `update organization.syncrun set state='failed',
    error_summary=$2,completed_at=clock_timestamp() where id=$1 and state in('queued','running')`,
      [run, code.slice(0, 200)]
    );
  }
  async markEventProcessed(context: WriteTransactionContext, connection: string, event: string): Promise<void> {
    await this.transactions.database(context).query(`update organization.directoryinbox set state='processed',processed_at=clock_timestamp() where connection_id=$1 and provider_event_id=$2`, [connection, event]);
  }
}
