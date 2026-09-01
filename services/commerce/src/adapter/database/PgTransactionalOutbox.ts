import { parseEventPayload } from '@shop/contract';
import type { TransactionalEventWriter } from '../../foundation/application/OperationExecutor';
import type { DomainEvent } from '../../foundation/domain/DomainEvent';
import type { WriteTransactionContext } from '../../foundation/persistence/TransactionContext';
import { PgTransactionAccess } from './PgTransactionAccess';

export class PgTransactionalOutbox implements TransactionalEventWriter {
  constructor(private readonly transactions: PgTransactionAccess) {}

  async append(context: WriteTransactionContext, event: DomainEvent): Promise<void> {
    const payload = parseEventPayload(event.type, event.payload);
    await this.transactions.database(context).query(
      `insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,aggregate_version,scope_id,payload,
      trace_id,actor_id,correlation_id,causation_id,payload_version,occurred_at,available_at)
      values($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,$13,$14,clock_timestamp())`,
      [
        event.event,
        event.type,
        event.version,
        event.aggregate.type,
        event.aggregate.id,
        event.aggregate.version,
        event.tenant,
        JSON.stringify(payload),
        event.trace,
        event.actor,
        event.correlation,
        event.causation,
        event.payloadVersion,
        event.occurred,
      ]
    );
  }
}
