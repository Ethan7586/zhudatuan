import { PgTransactionAccess, type SqlExecutor } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import { createHash, randomUUID } from 'node:crypto';
import type { DirectoryRepository, DirectoryCounts, StagedSubject, CurrentDirectorySubject, DirectoryApplyKind, DirectoryDeparture } from '../../application/port/DirectoryRepository';
import type { DirectoryPage } from '../../application/port/DirectoryProvider';
import { DirectoryConnection, type DirectoryConnectionValue } from '../../domain/model/DirectoryConnection';
import type { SyncRun, SyncMode } from '../../domain/model/SyncRun';
import { mapConnection, mapRun, runSummary, type ConnectionRow, type ConnectionSummaryRow, type RunRow, type RunSummaryRow } from './DirectoryRecord';
import { PgDirectorySubjectStore } from './PgDirectorySubjectStore';
export class PgDirectoryRepository implements DirectoryRepository { private readonly transactions = new PgTransactionAccess();
  private readonly subjects = new PgDirectorySubjectStore();
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
    return Object.freeze(result.rows.map(runSummary));
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
  async resumeRun(context: WriteTransactionContext, connection: string, source: string, key: string): Promise<SyncRun | null> {
    const id = randomUUID();
    const result = await this.transactions.database(context).query<RunRow>(
      `insert into organization.syncrun(id,connection_id,provider_run_id,mode,state,cursor_ciphertext,created_at)
      select $1,original.connection_id,$4,original.mode,'queued',case when original.mode='incremental' then connection.cursor_ciphertext else null end,clock_timestamp()
      from organization.syncrun original join organization.directoryconnection connection on connection.id=original.connection_id
      where original.id=$2 and original.connection_id=$3 and original.state in('failed','cancelled') and original.mode in('full','incremental')
      on conflict(connection_id,provider_run_id) do update set provider_run_id=excluded.provider_run_id
      returning id,connection_id,provider_run_id,mode,state,cursor_ciphertext,read_count,applied_count,conflict_count,ignored_count`,
      [id, source, connection, key]
    );
    const row = result.rows[0];
    return row ? mapRun(row) : null;
  }
  async cancelRun(context: WriteTransactionContext, connection: string, run: string): Promise<Readonly<Record<string, unknown>> | null> {
    const result = await this.transactions.database(context).query<RunSummaryRow>(
      `with changed as(update organization.syncrun set state='cancelled',completed_at=clock_timestamp()
      where id=$1 and connection_id=$2 and state in('queued','running')
      returning id,mode,state,read_count,applied_count,conflict_count,ignored_count,watermark,started_at,completed_at,created_at), selected as(
      select id,mode,state,read_count,applied_count,conflict_count,ignored_count,watermark,started_at,completed_at,created_at from changed union all
      select current.id,current.mode,current.state,current.read_count,current.applied_count,current.conflict_count,current.ignored_count,
      current.watermark,current.started_at,current.completed_at,current.created_at from organization.syncrun current where current.id=$1
      and current.connection_id=$2 and current.state='cancelled' and not exists(select 1 from changed))
      select id,mode,state,read_count,applied_count,conflict_count,ignored_count,watermark,started_at,completed_at,created_at from selected`,
      [run, connection]
    );
    const row = result.rows[0];
    return row ? runSummary(row) : null;
  }
  async startRun(context: WriteTransactionContext, run: string): Promise<SyncRun> {
    const database = this.transactions.database(context);
    const result = await database.query<RunRow>(
      `update organization.syncrun set state='running',started_at=coalesce(started_at,clock_timestamp())
      where id=$1 and state in('queued','running') returning id,connection_id,provider_run_id,mode,state,cursor_ciphertext,read_count,applied_count,conflict_count,ignored_count`,
      [run]
    );
    const row = result.rows[0];
    if (!row) {
      const current = await database.query<{ state: string }>('select state from organization.syncrun where id=$1', [run]);
      if (current.rows[0]?.state === 'cancelled') throw new Error('DIRECTORY_SYNC_CANCELLED');
      throw new Error('DIRECTORY_SYNC_STATE_INVALID');
    }
    return mapRun(row);
  }
  async active(context: ReadTransactionContext, run: string): Promise<boolean> { return (await this.transactions.database(context).query("select 1 from organization.syncrun where id=$1 and state in('queued','running')", [run])).rowCount === 1; }
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
    return this.subjects.current(context, connection, hashes);
  }
  async apply(context: WriteTransactionContext, connection: DirectoryConnection, subject: StagedSubject, kind: DirectoryApplyKind): Promise<void> {
    return this.subjects.apply(context, connection, subject, kind);
  }
  async advance(context: WriteTransactionContext, run: string, page: DirectoryPage, counts: DirectoryCounts): Promise<boolean> {
    const database = this.transactions.database(context);
    const result = await database.query(
      `update organization.syncrun set cursor_ciphertext=$2,read_count=read_count+$3,applied_count=applied_count+$4,
      conflict_count=conflict_count+$5,ignored_count=ignored_count+$6,watermark=clock_timestamp(),
      checksum=encode(public.digest(coalesce(checksum,'')||$7||':'||$8::text,'sha256'),'hex') where id=$1 and state='running'`,
      [run, page.cursor, counts.read, counts.applied, counts.conflicts, counts.ignored, page.eventid, page.version]
    );
    return result.rowCount === 1;
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
    return this.subjects.departures(context, connection);
  }
  async freeze(context: WriteTransactionContext, connection: string, subject: string): Promise<void> {
    return this.subjects.freeze(context, connection, subject);
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
