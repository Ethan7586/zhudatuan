import { randomUUID } from 'node:crypto';
import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import type { ChannelRepository } from '../../application/port/ChannelRepository';

export class PgChannelRepository implements ChannelRepository {
  constructor(private readonly database: OperationDatabase) {}

  async enqueue(kind: 'catalogsync' | 'pricesync' | 'inventorysync' | 'statementsync' | 'fulfillment' | 'paymentrefund',
    scope: string, payload: Readonly<Record<string, unknown>>, priority: number, stableId?: string): Promise<void> {
    await this.database.query(`insert into runtime.job(id,kind,owner,scope_id,payload,state,priority,available_at,created_at,updated_at)
      values($1,$2,'channel',$3,$4::jsonb,'queued',$5,clock_timestamp(),clock_timestamp(),clock_timestamp()) on conflict(id) do nothing`,
    [stableId ?? `job:${randomUUID()}`, kind, scope, JSON.stringify(payload), priority]);
  }
}
