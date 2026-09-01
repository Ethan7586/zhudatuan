import type { QueryResult, QueryResultRow } from 'pg';

export interface RuntimeSql {
  query<R extends QueryResultRow = QueryResultRow>(text: string, values?: readonly unknown[]): Promise<QueryResult<R>>;
}

export interface RuntimeJobInput {
  readonly id: string;
  readonly kind: string;
  readonly owner: string;
  readonly scope: string | null;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly priority: number;
  readonly availableAt?: string;
}

export interface RuntimeEventInput {
  readonly id: string;
  readonly type: string;
  readonly aggregateType: string;
  readonly aggregate: string;
  readonly scope: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly trace: string;
  readonly version?: number;
}

export interface RuntimeInboxEvent {
  readonly id: string;
  readonly type: string;
  readonly version: number;
  readonly aggregate: string;
  readonly scope: string;
  readonly payload: Record<string, unknown>;
  readonly occurredAt: string;
}

export class PgRuntimeWriter {
  constructor(private readonly database: RuntimeSql) {}

  async schedule(job: RuntimeJobInput): Promise<void> {
    await this.database.query(
      `insert into runtime.job(id,kind,owner,scope_id,payload,state,priority,available_at,created_at,updated_at)
       values($1,$2,$3,$4,$5::jsonb,'queued',$6,coalesce($7::timestamptz,clock_timestamp()),clock_timestamp(),clock_timestamp())
       on conflict(id) do nothing`,
      [job.id, job.kind, job.owner, job.scope, JSON.stringify(job.payload), job.priority, job.availableAt ?? null]
    );
  }

  async reschedule(job: RuntimeJobInput): Promise<void> {
    await this.database.query(
      `insert into runtime.job(id,kind,owner,scope_id,payload,state,priority,available_at,created_at,updated_at)
       values($1,$2,$3,$4,$5::jsonb,'queued',$6,coalesce($7::timestamptz,clock_timestamp()),clock_timestamp(),clock_timestamp())
       on conflict(id) do update set state='queued',payload=excluded.payload,priority=excluded.priority,
       available_at=excluded.available_at,updated_at=clock_timestamp(),attempts=0`,
      [job.id, job.kind, job.owner, job.scope, JSON.stringify(job.payload), job.priority, job.availableAt ?? null]
    );
  }

  async retryFailed(job: RuntimeJobInput): Promise<void> {
    await this.database.query(
      `insert into runtime.job(id,kind,owner,scope_id,payload,state,priority,available_at,created_at,updated_at)
       values($1,$2,$3,$4,$5::jsonb,'queued',$6,coalesce($7::timestamptz,clock_timestamp()),clock_timestamp(),clock_timestamp())
       on conflict(id) do update set state='queued',payload=excluded.payload,priority=excluded.priority,
       available_at=excluded.available_at,updated_at=clock_timestamp(),attempts=0,last_error=null
       where runtime.job.state='failed'`,
      [job.id, job.kind, job.owner, job.scope, JSON.stringify(job.payload), job.priority, job.availableAt ?? null]
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
    const result = await this.database.query<{ scope_id: string | null }>('select scope_id from runtime.job where id=$1', [job]);
    return result.rows[0]?.scope_id ?? null;
  }

  async jobEventContext(consumer: string, event: string): Promise<Readonly<{ scope: string; receivedAt: string }> | null> {
    const result = await this.database.query<{ scope: string; receivedAt: string }>(
      `select job.scope_id scope,inbox.received_at "receivedAt" from runtime.job job
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

  async deadletter(input: Readonly<{ id: string; kind: string; source: string; owner: string; payload: Readonly<Record<string, unknown>>; error: string }>): Promise<void> {
    await this.database.query(
      `insert into runtime.deadletter(id,kind,source_id,owner,payload,error_code,attempts,failed_at)
       values($1,$2,$3,$4,$5::jsonb,$6,1,clock_timestamp())
       on conflict(kind,source_id) do update set payload=excluded.payload,failed_at=excluded.failed_at,reviewed_at=null`,
      [input.id, input.kind, input.source, input.owner, JSON.stringify(input.payload), input.error]
    );
  }

  async reviewDeadletter(id: unknown, owner: string): Promise<boolean> {
    if (typeof id !== 'string' || id.length === 0) return false;
    const result = await this.database.query(
      `update runtime.deadletter set reviewed_at=clock_timestamp()
       where id=$1 and owner=$2 and reviewed_at is null`,
      [id, owner]
    );
    return result.rowCount === 1;
  }

  async reviewDeadlettersByPayload(owner: string, key: string, value: string): Promise<number> {
    const result = await this.database.query(
      `update runtime.deadletter set reviewed_at=clock_timestamp()
       where owner=$1 and payload->>$2=$3 and reviewed_at is null`,
      [owner, key, value]
    );
    return result.rowCount ?? 0;
  }

  async hasActiveJob(kind: string, key: string, value: string): Promise<boolean> {
    const result = await this.database.query(`select 1 from runtime.job where kind=$1 and payload->>$2=$3 and state in('queued','running') limit 1`, [kind, key, value]);
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
}
