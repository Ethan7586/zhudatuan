import { randomUUID } from 'node:crypto';
import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import type { IdentityEventPort } from '../../application/port/IdentityEventPort';

export class PgIdentityEvent implements IdentityEventPort {
  async publish(
    database: OperationDatabase,
    type: string,
    aggregateType: 'invitation' | 'session' | 'challenge' | 'membership' | 'linkcase' | 'principal',
    aggregate: string,
    scope: string,
    trace: string,
    payload: Readonly<Record<string, unknown>>
  ): Promise<void> {
    await database.query(
      `insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,
      occurred_at,available_at) values($1,$2,1,$3,$4,$5,$6::jsonb,$7,clock_timestamp(),clock_timestamp())`,
      [`event:${randomUUID()}`, type, aggregateType, aggregate, scope, JSON.stringify(payload), trace]
    );
  }
}
