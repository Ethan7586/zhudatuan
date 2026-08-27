import { randomUUID } from 'node:crypto';
import { EVENT_HANDLERS, eventVersion } from '../../app/events';
import type { DatabasePool } from '../persistence/Pool';
import type { EventPublisher } from './OutboxRelay';
import { InboxStore } from './InboxStore';
import type { OutboxEvent } from './OutboxStore';

export class RuntimeEventPublisher implements EventPublisher {
  private readonly inbox = new InboxStore();
  constructor(private readonly pool: DatabasePool) {}

  async publish(event: OutboxEvent): Promise<void> {
    const handlers = EVENT_HANDLERS.get(event.event_type);
    if (!handlers) throw new Error(`EVENT_HANDLER_CATALOG_MISSING:${event.event_type}`);
    if (event.event_version !== eventVersion(event.event_type)) throw new Error(`EVENT_VERSION_UNSUPPORTED:${event.event_type}:${event.event_version}`);
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      for (const handler of handlers) {
        const accepted = await this.inbox.accept(client, `job:${handler}`, event);
        if (accepted) await client.query(`insert into runtime.job(id,kind,owner,scope_id,payload,state,priority,available_at,created_at,updated_at)
          values($1,$2,$2,$3,jsonb_build_object('eventId',$4::text,'event',$5::text,'payload',$6::jsonb),'queued',50,clock_timestamp(),clock_timestamp(),clock_timestamp())`,
        [`job:${randomUUID()}`, handler, event.scope_id, event.id, event.event_type, JSON.stringify(event.payload)]);
      }
      await client.query('commit');
    } catch (cause) { await client.query('rollback'); throw cause; } finally { client.release(); }
  }
}
