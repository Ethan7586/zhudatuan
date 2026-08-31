import { randomUUID } from 'node:crypto';
import { eventVersion } from '../../app/events';
import type { EventRegistry } from '../../bootstrap/EventRegistry';
import type { DatabasePool } from '../../foundation/persistence/Pool';
import type { EventPublisher, OutboxMessage } from '../../foundation/messaging/Outbox';
import { PgInbox } from '../database/PgInbox';
import { parseEventPayload } from '@shop/contract';

export class RuntimeEventPublisher implements EventPublisher {
  private readonly inbox = new PgInbox();
  constructor(
    private readonly pool: DatabasePool,
    private readonly events: EventRegistry
  ) {}

  async publish(event: OutboxMessage): Promise<void> {
    const handlers = this.events.handlers(event.event_type);
    if (event.event_version !== eventVersion(event.event_type)) throw new Error(`EVENT_VERSION_UNSUPPORTED:${event.event_type}:${event.event_version}`);
    const payload = parseEventPayload(event.event_type, event.payload);
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      for (const handler of handlers) {
        const accepted = await this.inbox.accept(client, 'internal', `job:${handler}`, event);
        if (accepted)
          await client.query(
            `insert into runtime.job(id,kind,owner,scope_id,payload,state,priority,available_at,created_at,updated_at)
          values($1,$2,$2,$3,jsonb_build_object('eventId',$4::text,'event',$5::text,'scopeId',$3::text,
            'aggregateId',$7::text,'aggregateVersion',$8::integer,'actorId',$9::text,'correlationId',$10::text,
            'causationId',$11::text,'payloadVersion',$12::integer,'payload',$6::jsonb),'queued',50,clock_timestamp(),clock_timestamp(),clock_timestamp())`,
            [`job:${randomUUID()}`, handler, event.scope_id, event.id, event.event_type, JSON.stringify(payload), event.aggregate_id, event.aggregate_version, event.actor_id, event.correlation_id, event.causation_id, event.payload_version]
          );
      }
      await client.query('commit');
    } catch (cause) {
      await client.query('rollback');
      throw cause;
    } finally {
      client.release();
    }
  }
}
