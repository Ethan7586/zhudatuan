import { createHash } from 'node:crypto';
import type { QueryResult, QueryResultRow } from 'pg';
import { jobDefinition, type JobKind } from '../../pipeline/JobCatalog';
import { QueueAdmission } from '../../modules/runtime/infrastructure/queue/QueueAdmission';

import type { RuntimeEventInput, RuntimeInboxEvent, RuntimeJobInput, RuntimeSql } from './RuntimeRecord';
export type { RuntimeEventInput, RuntimeInboxEvent, RuntimeJobInput, RuntimeSql } from './RuntimeRecord';

export class PgRuntimeWriter {
  private readonly admission: QueueAdmission;
  constructor(private readonly database: RuntimeSql) {
    this.admission = new QueueAdmission(database);
  }

  async schedule(job: RuntimeJobInput): Promise<void> {
    const definition = this.definition(job);
    await this.admission.assert({ id: job.id, queue: definition.queue, priority: job.priority });
    await this.database.query(
      `insert into runtime.jobs(id,tenant_id,scope_id,kind,owner,queue,payload,state,priority,available_at,checkpoint,progress,
       idempotency_key,retention_until,version,authorization_snapshot,created_by,updated_by,created_at,updated_at)
       values($1,$4,$4,$2,$3,$8,$5::jsonb,'queued',$6,coalesce($7::timestamptz,clock_timestamp()),'{}',0,$1,
       clock_timestamp()+interval '90 days',1,coalesce($9::jsonb,runtime.current_task_authorization()),coalesce(nullif(current_setting('app.actor_id',true),''),'system:runtime'),
       coalesce(nullif(current_setting('app.actor_id',true),''),'system:runtime'),clock_timestamp(),clock_timestamp())
       on conflict(id) do nothing`,
      [
        job.id,
        job.kind,
        definition.owner,
        job.scope ?? 'organization-platform-root',
        JSON.stringify(job.payload),
        job.priority,
        job.availableAt ?? null,
        definition.queue,
        job.authorization === undefined ? null : JSON.stringify(job.authorization),
      ]
    );
  }

  async reschedule(job: RuntimeJobInput): Promise<void> {
    const definition = this.definition(job);
    await this.admission.assert({ id: job.id, queue: definition.queue, priority: job.priority });
    await this.database.query(
      `insert into runtime.jobs(id,tenant_id,scope_id,kind,owner,queue,payload,state,priority,available_at,checkpoint,progress,
       idempotency_key,retention_until,version,authorization_snapshot,created_by,updated_by,created_at,updated_at)
       values($1,$4,$4,$2,$3,$8,$5::jsonb,'queued',$6,coalesce($7::timestamptz,clock_timestamp()),'{}',0,$1,
       clock_timestamp()+interval '90 days',1,coalesce($9::jsonb,runtime.current_task_authorization()),coalesce(nullif(current_setting('app.actor_id',true),''),'system:runtime'),
       coalesce(nullif(current_setting('app.actor_id',true),''),'system:runtime'),clock_timestamp(),clock_timestamp())
       on conflict(id) do update set state='queued',payload=excluded.payload,priority=excluded.priority,
       available_at=excluded.available_at,queue=excluded.queue,lease_owner=null,lease_deadline=null,cancel_requested_at=null,
       version=runtime.jobs.version+1,updated_by=excluded.updated_by,updated_at=clock_timestamp(),attempts=0`,
      [
        job.id,
        job.kind,
        definition.owner,
        job.scope ?? 'organization-platform-root',
        JSON.stringify(job.payload),
        job.priority,
        job.availableAt ?? null,
        definition.queue,
        job.authorization === undefined ? null : JSON.stringify(job.authorization),
      ]
    );
  }

  async retryFailed(job: RuntimeJobInput): Promise<void> {
    const definition = this.definition(job);
    await this.admission.assert({ id: job.id, queue: definition.queue, priority: job.priority });
    await this.database.query(
      `insert into runtime.jobs(id,tenant_id,scope_id,kind,owner,queue,payload,state,priority,available_at,checkpoint,progress,
       idempotency_key,retention_until,version,authorization_snapshot,created_by,updated_by,created_at,updated_at)
       values($1,$4,$4,$2,$3,$8,$5::jsonb,'queued',$6,coalesce($7::timestamptz,clock_timestamp()),'{}',0,$1,
       clock_timestamp()+interval '90 days',1,coalesce($9::jsonb,runtime.current_task_authorization()),coalesce(nullif(current_setting('app.actor_id',true),''),'system:runtime'),
       coalesce(nullif(current_setting('app.actor_id',true),''),'system:runtime'),clock_timestamp(),clock_timestamp())
       on conflict(id) do update set state='queued',payload=excluded.payload,priority=excluded.priority,
       available_at=excluded.available_at,queue=excluded.queue,lease_owner=null,lease_deadline=null,cancel_requested_at=null,
       checkpoint=runtime.jobs.checkpoint-'errorCode',version=runtime.jobs.version+1,updated_by=excluded.updated_by,
       updated_at=clock_timestamp(),attempts=0 where runtime.jobs.state in('failed','deadlettered')`,
      [
        job.id,
        job.kind,
        definition.owner,
        job.scope ?? 'organization-platform-root',
        JSON.stringify(job.payload),
        job.priority,
        job.availableAt ?? null,
        definition.queue,
        job.authorization === undefined ? null : JSON.stringify(job.authorization),
      ]
    );
  }

  async latestEventPayload(type: string, aggregate: string): Promise<unknown | null> {
    const result = await this.database.query<{ payload: unknown }>(
      `select payload from runtime.outbox where event_type=$1 and aggregate_id=$2
       order by occurred_at desc,id desc limit 1`,
      [type, aggregate]
    );
    return result.rows[0]?.payload ?? null;
  }

  async jobScope(job: string): Promise<string | null> {
    const result = await this.database.query<{ scope_id: string | null }>('select scope_id from runtime.jobs where id=$1', [job]);
    return result.rows[0]?.scope_id ?? null;
  }

  async jobEventContext(consumer: string, event: string): Promise<Readonly<{ scope: string; receivedAt: string }> | null> {
    const result = await this.database.query<{ scope: string; receivedAt: string }>(
      `select job.scope_id scope,inbox.received_at "receivedAt" from runtime.jobs job
       join runtime.inbox inbox on inbox.event_id=$2 and inbox.consumer=$1 where job.payload->>'eventId'=$2 limit 1`,
      [consumer, event]
    );
    return result.rows[0] ? Object.freeze(result.rows[0]) : null;
  }

  async lockInbox(consumer: string, event: string): Promise<boolean> {
    const result = await this.database.query(`select 1 from runtime.inbox where consumer=$1 and event_id=$2 and processed_at is null for update`, [consumer, event]);
    return result.rows.length > 0;
  }

  async completeInbox(consumer: string, event: string): Promise<boolean> {
    const result = await this.database.query(
      `update runtime.inbox set processed_at=clock_timestamp(),attempts=attempts+1
      where consumer=$1 and event_id=$2 and processed_at is null`,
      [consumer, event]
    );
    return result.rowCount === 1;
  }

  async acceptInbox(input: Readonly<{ consumer: string; event: string; type: string; version?: number; trace: string; payload: Readonly<Record<string, unknown>> }>): Promise<boolean> {
    const result = await this.database.query(
      `insert into runtime.inbox(consumer,event_id,event_type,event_version,trace_id,payload,received_at)
      values($1,$2,$3,$4,$5,$6::jsonb,clock_timestamp()) on conflict(consumer,event_id) do nothing`,
      [input.consumer, input.event, input.type, input.version ?? 1, input.trace, JSON.stringify(input.payload)]
    );
    return result.rowCount === 1;
  }

  async append(event: RuntimeEventInput): Promise<void> {
    await this.database.query(
      `insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,occurred_at,available_at)
       values($1,$2,$3,$4,$5,$6,$7::jsonb,$8,clock_timestamp(),clock_timestamp()) on conflict(id) do nothing`,
      [event.id, event.type, event.version ?? 1, event.aggregateType, event.aggregate, event.scope, JSON.stringify(event.payload), event.trace]
    );
  }

  async appendMany(events: readonly RuntimeEventInput[]): Promise<void> {
    if (events.length === 0) return;
    await this.database.query(
      `insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,aggregate_version,scope_id,payload,
       trace_id,actor_id,correlation_id,causation_id,payload_version,occurred_at,available_at)
       select input.id,input.type,coalesce(input.version,1),input."aggregateType",input.aggregate,input."aggregateVersion",input.scope,
       input.payload,input.trace,input.actor,input.correlation,input.causation,coalesce(input."payloadVersion",input.version,1),
       clock_timestamp(),clock_timestamp()
       from jsonb_to_recordset($1::jsonb) as input(id text,type text,version integer,"aggregateType" text,aggregate text,
       "aggregateVersion" bigint,scope text,payload jsonb,trace text,actor text,correlation text,causation text,"payloadVersion" integer)
       on conflict(id) do nothing`,
      [JSON.stringify(events)]
    );
  }

  async deadletter(input: Readonly<{ id: string; kind: string; source: string; owner: string; payload: Readonly<Record<string, unknown>>; error: string }>): Promise<void> {
    await this.database.query(
      `insert into runtime.deadletters(id,tenant_id,scope_id,source_kind,source_id,owner,payload,error_code,attempts,state,
       version,failed_at,retention_until) values($1,coalesce(nullif(current_setting('app.tenant_id',true),''),'organization-platform-root'),
       coalesce(nullif(current_setting('app.scope_id',true),''),'organization-platform-root'),$2,$3,$4,$5::jsonb,$6,1,'open',1,
       clock_timestamp(),clock_timestamp()+interval '90 days') on conflict(source_kind,source_id) do update set
       payload=excluded.payload,error_code=excluded.error_code,attempts=runtime.deadletters.attempts+1,state='open',
       version=runtime.deadletters.version+1,failed_at=excluded.failed_at,reviewed_by=null,reviewed_at=null`,
      [`deadletter:${createHash('sha256').update(`${input.kind}\u0000${input.source}`).digest('hex')}`, input.kind, input.source, input.owner, JSON.stringify(input.payload), input.error]
    );
  }

  async reviewDeadletter(id: unknown, owner: string): Promise<boolean> {
    if (typeof id !== 'string' || id.length === 0) return false;
    const result = await this.database.query(
      `update runtime.deadletters set state='resolved',resolution='人工确认',reviewed_by=coalesce(nullif(current_setting('app.actor_id',true),''),'system:runtime'),
       reviewed_at=clock_timestamp(),version=version+1 where id=$1 and owner=$2 and state='open'`,
      [id, owner]
    );
    return result.rowCount === 1;
  }

  async reviewDeadlettersByPayload(owner: string, key: string, value: string): Promise<number> {
    const result = await this.database.query(
      `update runtime.deadletters set state='resolved',resolution='人工确认',reviewed_by=coalesce(nullif(current_setting('app.actor_id',true),''),'system:runtime'),
       reviewed_at=clock_timestamp(),version=version+1 where owner=$1 and payload->>$2=$3 and state='open'`,
      [owner, key, value]
    );
    return result.rowCount ?? 0;
  }

  async hasActiveJob(kind: string, key: string, value: string): Promise<boolean> {
    const result = await this.database.query(`select 1 from runtime.jobs where kind=$1 and payload->>$2=$3 and state in('queued','running') limit 1`, [kind, key, value]);
    return result.rows.length > 0;
  }

  async claim(consumer: string, event: string): Promise<RuntimeInboxEvent | null> {
    const result = await this.database.query<RuntimeInboxEvent>(
      `select inbox.event_id id,inbox.event_type type,inbox.event_version version,
       outbox.aggregate_id aggregate,outbox.scope_id scope,inbox.payload,outbox.occurred_at "occurredAt"
       from runtime.inbox inbox join runtime.outbox outbox on outbox.id=inbox.event_id
       where inbox.consumer=$1 and inbox.event_id=$2 and inbox.processed_at is null for update of inbox`,
      [consumer, event]
    );
    return result.rows[0] ? Object.freeze(result.rows[0]) : null;
  }

  async completeProjection(consumer: string, event: RuntimeInboxEvent, scopes: readonly string[]): Promise<readonly Readonly<{ scope: string; version: number }>[]> {
    const completed = await this.database.query('update runtime.inbox set processed_at=clock_timestamp(),attempts=attempts+1 where consumer=$1 and event_id=$2 and processed_at is null', [consumer, event.id]);
    if (completed.rowCount !== 1) throw new Error('RUNTIME_INBOX_LEASE_LOST');
    const offset = await this.database.query<{ scope: string; version: number }>(
      `insert into runtime.projectionoffset(projection,shard,offset_value,watermark,version)
       select 'commerce',scope,$2,$3,1 from unnest($1::text[]) scope
       on conflict(projection,shard) do update set offset_value=excluded.offset_value,
       watermark=greatest(runtime.projectionoffset.watermark,excluded.watermark),version=runtime.projectionoffset.version+1
       returning shard scope,version`,
      [[...new Set(scopes)], event.id, event.occurredAt]
    );
    if (offset.rows.length === 0) throw new Error('RUNTIME_PROJECTION_OFFSET_FAILED');
    return Object.freeze(offset.rows.map((row) => Object.freeze(row)));
  }

  private definition(job: RuntimeJobInput) {
    if (!job.id.startsWith('job:')) throw new Error('JOB_ID_INVALID');
    return jobDefinition(job.kind as JobKind);
  }
}
