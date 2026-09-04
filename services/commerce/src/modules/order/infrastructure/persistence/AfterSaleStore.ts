import { randomUUID } from 'node:crypto';
import { PgRuntimeWriter } from '../../../../adapter/database/PgRuntimeWriter';
import type { SqlExecutor } from '../../../../adapter/database/PgTransactionAccess';
import { DomainError } from '../../../../foundation/domain/DomainError';
import type { VerifiedAfterSaleAttachment } from '../../application/service/AfterSaleAttachment';
import type { LineRow, OrderRow } from './AfterSaleAvailability';

export async function loadAfterSaleOrder(database: SqlExecutor, id: string, member: string, lock: boolean): Promise<OrderRow> {
  const result = await database.query<OrderRow>(
    `select id,scope_id,member_id,currency,lifecycle_state,payment_state,fulfillment_state,aftersale_state,evidence
    from ordering.orderrecord where id=$1 and member_id=$2${lock ? ' for update' : ''}`,
    [id, member]
  );
  const row = result.rows[0];
  if (!row) throw new DomainError('RESOURCE_NOT_FOUND');
  return row;
}

export async function loadAfterSaleLines(database: SqlExecutor, order: string, ids: readonly string[], lock: boolean): Promise<readonly LineRow[]> {
  const result = await database.query<LineRow>(
    `select id,sku_id,listing_id,title_snapshot,quantity::float8 quantity,fulfilled_quantity::float8 fulfilled_quantity,
    aftersale_quantity::float8 aftersale_quantity,payable_minor::float8 payable_minor,provider,
    coalesce(evidence->>'productType','physical') product_type,fulfilled_at,
    coalesce(evidence->'providerRule','{}') provider_rule from ordering.line
    where order_id=$1 and (cardinality($2::text[])=0 or id=any($2::text[])) order by id${lock ? ' for update' : ''}`,
    [order, ids]
  );
  return Object.freeze(result.rows);
}

export async function attachAfterSale(database: SqlExecutor, aftersale: string, attachments: readonly VerifiedAfterSaleAttachment[]): Promise<void> {
  for (const [index, item] of attachments.entries()) {
    await database.query(
      `insert into ordering.aftersaleattachment(aftersale_id,sequence,object_id,file_name,media_type,size_bytes,content_hash,created_at)
      values($1,$2,$3,$4,$5,$6,$7,clock_timestamp())`,
      [aftersale, index + 1, item.objectId, item.name, item.mediaType, item.sizeBytes, item.contentHash]
    );
  }
}

export async function transitionAfterSale(database: SqlExecutor, id: string, previous: string, next: string, kind: string, actor: string, evidence: unknown): Promise<void> {
  const changed = await database.query(`update ordering.aftersale set state=$3,version=version+1,updated_at=clock_timestamp() where id=$1 and state=$2 returning id`, [id, previous, next]);
  if (!changed.rows[0]) throw new DomainError('ORDER_AFTERSALE_NOT_ALLOWED');
  await appendAfterSaleTimeline(database, id, previous, next, kind, actor, evidence);
}

export async function appendAfterSaleTimeline(database: SqlExecutor, id: string, previous: string | null, next: string, kind: string, actor: string, evidence: unknown): Promise<void> {
  await database.query(
    `insert into ordering.aftersaletimeline(id,aftersale_id,sequence,kind,previous_state,next_state,actor_id,evidence,occurred_at)
    select $1,$2,coalesce(max(sequence),0)+1,$3,$4,$5,$6,$7::jsonb,clock_timestamp()
    from ordering.aftersaletimeline where aftersale_id=$2`,
    [`timeline:${randomUUID()}`, id, kind, previous, next, actor, JSON.stringify(evidence)]
  );
}

export async function appendAfterSaleEvent(database: SqlExecutor, id: string, scope: string, type: string, trace: string, payload: unknown): Promise<void> {
  await new PgRuntimeWriter(database).append({ id: `event:${randomUUID()}`, type, aggregateType: 'aftersale', aggregate: id, scope, payload: { aftersale: id, ...(payload as Record<string, unknown>) }, trace });
}

export async function scheduleAfterSaleJob(database: SqlExecutor, id: string, kind: string, owner: string, scope: string, payload: unknown): Promise<void> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('ORDER_JOB_PAYLOAD_INVALID');
  await new PgRuntimeWriter(database).schedule({ id, kind, owner, scope, payload: payload as Readonly<Record<string, unknown>>, priority: 10 });
}
