import { randomUUID } from 'node:crypto';
import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import type { FinanceRepository } from '../../03_application_yingyong/port/FinanceRepository';

/** Finance-owned persistence primitives shared by commands; callers retain the surrounding unit of work. */
export class PgFinanceRepository implements FinanceRepository {
  constructor(private readonly database: OperationDatabase) {}

  async enqueue(kind: 'reconciliation' | 'settlement' | 'invoice', scope: string, payload: unknown, id: string,
    replay = false, priority = 20): Promise<void> {
    await this.database.query(`insert into runtime.job(id,kind,owner,scope_id,payload,state,priority,available_at,created_at,updated_at)
      values($1,$2,'finance',$3,$4::jsonb,'queued',$5,clock_timestamp(),clock_timestamp(),clock_timestamp()) on conflict(id) do update
      set state='queued',attempts=0,last_error=null,available_at=clock_timestamp(),updated_at=clock_timestamp()
      where $6::boolean and runtime.job.state='failed'`, [id, kind, scope, JSON.stringify(payload), priority, replay]);
  }

  async event(type: string, aggregateType: string, aggregate: string, scope: string, payload: unknown, stableId?: string): Promise<void> {
    const id = stableId ?? `event:${randomUUID()}`;
    await this.database.query(`insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,
      occurred_at,available_at) values($1,$2,1,$3,$4,$5,$6::jsonb,$1,clock_timestamp(),clock_timestamp()) on conflict(id) do nothing`,
    [id, type, aggregateType, aggregate, scope, JSON.stringify(payload)]);
  }
}
