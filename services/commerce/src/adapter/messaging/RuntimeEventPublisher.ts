import { randomUUID } from 'node:crypto';
import { eventVersion } from '../../app/events';
import type { DatabasePool } from '../../foundation/persistence/Pool';
import type { EventPublisher, OutboxMessage } from '../../foundation/messaging/Outbox';
import { PgInbox } from '../database/PgInbox';
import { parseEventPayload } from '@shop/contract';
import { PgTransactionManager } from '../database/PgTransactionManager';
import { PgTransactionAccess } from '../database/PgTransactionAccess';
import { jobDefinition, type JobKind } from '../../foundation/application/JobCatalog';
import { QueueAdmission } from '../../modules/runtime/infrastructure/queue/QueueAdmission';

export class RuntimeEventPublisher implements EventPublisher {
  private readonly inbox = new PgInbox();
  private readonly manager: PgTransactionManager;
  private readonly transactions = new PgTransactionAccess();
  constructor(
    pool: DatabasePool,
    private readonly events: Readonly<{ handlers(event: string): readonly string[] }>
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
        const definition = jobDefinition(handler as JobKind);
        const accepted = await this.inbox.accept(context, 'internal', `job:${handler}`, event);
        if (accepted) {
          const id = `job:${randomUUID()}`;
          await new QueueAdmission(database).assert({ id, queue: definition.queue, priority: 50 });
          await database.query(
            `insert into runtime.jobs(id,tenant_id,scope_id,kind,owner,queue,payload,state,priority,available_at,checkpoint,progress,
             idempotency_key,retention_until,version,created_by,updated_by,created_at,updated_at)
          values($1,$3,$3,$2,$13,$14,jsonb_build_object('eventId',$4::text,'event',$5::text,'scopeId',$3::text,
            'aggregateId',$7::text,'aggregateVersion',$8::integer,'actorId',$9::text,'correlationId',$10::text,
            'causationId',$11::text,'payloadVersion',$12::integer,'payload',$6::jsonb),'queued',50,clock_timestamp(),'{}',0,$1,
            clock_timestamp()+interval '90 days',1,'runtime:event','runtime:event',clock_timestamp(),clock_timestamp())`,
            [id, handler, event.scope_id, event.id, event.event_type, JSON.stringify(payload), event.aggregate_id, event.aggregate_version, event.actor_id, event.correlation_id, event.causation_id, event.payload_version, definition.owner, definition.queue]
          );
        }
      }
    });
  }
}
