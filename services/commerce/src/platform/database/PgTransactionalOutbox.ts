import { parseEventPayload } from '@shop/contract';
import type { TransactionalEventWriter } from '../../pipeline/OperationExecutor';
import type { DomainEvent } from '@shop/kernel';
import type { WriteTransactionContext } from '../../platform/database/TransactionContext';
import { PgTransactionAccess } from './PgTransactionAccess';

export class PgTransactionalOutbox implements TransactionalEventWriter {
  constructor(private readonly transactions: PgTransactionAccess = new PgTransactionAccess()) {}

  async append(context: WriteTransactionContext, event: DomainEvent): Promise<void> {
    await this.appendMany(context, [event]);
  }

  async appendMany(context: WriteTransactionContext, events: readonly DomainEvent[]): Promise<void> {
    if (events.length === 0) return;
    const rows = events.map((event) => ({
      id: event.event,
      eventType: event.type,
      eventVersion: event.version,
      aggregateType: event.aggregate.type,
      aggregateId: event.aggregate.id,
      aggregateVersion: event.aggregate.version,
      scope: event.tenant,
      payload: parseEventPayload(event.type, event.payload),
      trace: event.trace,
      actor: event.actor,
      correlation: event.correlation,
      causation: event.causation,
      payloadVersion: event.payloadVersion,
      occurred: event.occurred,
    }));
    await this.transactions.database(context).query(
      `insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,aggregate_version,scope_id,payload,
      trace_id,actor_id,correlation_id,causation_id,payload_version,occurred_at,available_at)
      select item.id,item."eventType",item."eventVersion",item."aggregateType",item."aggregateId",item."aggregateVersion",item.scope,
      item.payload,item.trace,item.actor,item.correlation,item.causation,item."payloadVersion",item.occurred,clock_timestamp()
      from jsonb_to_recordset($1::jsonb) item(id text,"eventType" text,"eventVersion" integer,"aggregateType" text,
      "aggregateId" text,"aggregateVersion" bigint,scope text,payload jsonb,trace text,actor text,correlation text,causation text,
      "payloadVersion" integer,occurred timestamptz)`,
      [JSON.stringify(rows)]
    );
  }
}
