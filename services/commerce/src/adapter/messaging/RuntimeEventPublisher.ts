import { randomUUID } from 'node:crypto';
import { eventVersion } from '../../app/events';
import type { EventRegistry } from '../../bootstrap/EventRegistry';
import type { DatabasePool } from '../../foundation/persistence/Pool';
import type { EventPublisher, OutboxMessage } from '../../foundation/messaging/Outbox';
import { PgInbox } from '../database/PgInbox';
import { parseEventPayload } from '@shop/contract';
import { PgTransactionManager } from '../database/PgTransactionManager';
import { PgTransactionAccess } from '../database/PgTransactionAccess';

export class RuntimeEventPublisher implements EventPublisher {
  private readonly inbox = new PgInbox();
  private readonly manager: PgTransactionManager;
  private readonly transactions = new PgTransactionAccess();
  constructor(
    pool: DatabasePool,
    private readonly events: EventRegistry
  ) {
    this.manager = new PgTransactionManager(pool);
  }

  async publish(event: OutboxMessage, signal: AbortSignal, deadline: number): Promise<void> {
    const handlers = this.events.handlers(event.event_type);
    if (event.event_version !== eventVersion(event.event_type)) throw new Error(`EVENT_VERSION_UNSUPPORTED:${event.event_type}:${event.event_version}`);
    const payload = parseEventPayload(event.event_type, event.payload);
    await this.manager.write({ tenant: event.scope_id, membership: '', scope: event.scope_id, actor: 'runtime:event', trace: event.trace_id, operation: 'runtime.event.publish', workload: 'jobs', signal, deadline }, async (context) => {
      const database = this.transactions.database(context);
      for (const handler of handlers) {
        const accepted = await this.inbox.accept(context, 'internal', `job:${handler}`, event);
        if (accepted)
          await database.query(
            `insert into runtime.job(id,kind,owner,scope_id,payload,state,priority,available_at,created_at,updated_at)
          values($1,$2,$2,$3,jsonb_build_object('eventId',$4::text,'event',$5::text,'scopeId',$3::text,
            'aggregateId',$7::text,'aggregateVersion',$8::integer,'actorId',$9::text,'correlationId',$10::text,
            'causationId',$11::text,'payloadVersion',$12::integer,'payload',$6::jsonb),'queued',50,clock_timestamp(),clock_timestamp(),clock_timestamp())`,
            [`job:${randomUUID()}`, handler, event.scope_id, event.id, event.event_type, JSON.stringify(payload), event.aggregate_id, event.aggregate_version, event.actor_id, event.correlation_id, event.causation_id, event.payload_version]
          );
      }
    });
  }
}
