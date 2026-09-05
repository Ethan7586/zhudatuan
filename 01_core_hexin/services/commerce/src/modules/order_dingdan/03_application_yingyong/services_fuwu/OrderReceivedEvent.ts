import { createHash } from 'node:crypto';
import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';

export interface OrderReceivedEventInput {
  readonly order: string;
  readonly mall: string;
  readonly member: string;
  readonly source: 'fulfillment' | 'member';
  readonly actor?: string;
  readonly correlation: string;
}

export async function publishOrderReceived(database: OperationDatabase, input: OrderReceivedEventInput): Promise<void> {
  await database.query(
    `insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,correlation_id,occurred_at,created_at)
    values($1,'order.received',1,'order',$2,$3,
      jsonb_build_object('mall',$3,'order',$2,'member',$4,'source',$5,'actor',$6::text),
      $7,clock_timestamp(),clock_timestamp())
    on conflict(id) do nothing`,
    [eventId(input.order), input.order, input.mall, input.member, input.source, input.actor ?? null, input.correlation]
  );
}

function eventId(order: string): string {
  const digest = createHash('sha256').update(order).digest('hex').slice(0, 32);
  return `event:order:received:${digest}`;
}
