import { createHash } from 'node:crypto';
import type { PgTransactionAccess, SqlExecutor } from '../../../../platform/database/PgTransactionAccess';
import { DomainError } from '../../../../platform/error/DomainError';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { StoreWorkRepository } from '../../application/port/StoreWorkRepository';
import { FulfillmentState } from '../../domain/model/FulfillmentState';
import { fulfillmentDigest } from './FulfillmentJobValue';
import { projectFulfillment } from './FulfillmentProjection';
import { FulfillmentScopeReader } from './FulfillmentScopeReader';

export class PgStoreWorkRepository implements StoreWorkRepository {
  constructor(
    private readonly transactions: PgTransactionAccess,
    private readonly scopes: FulfillmentScopeReader
  ) {}

  async work(context: ReadTransactionContext, scope: string, states: Parameters<StoreWorkRepository['work']>[2], page: Parameters<StoreWorkRepository['work']>[3]) {
    const result = await this.transactions.database(context).query(
      `${WORK_SELECT}
      where (target.store_id=$1 or target.partner_id=$1)
      and (cardinality($2::text[])=0 or target.state=any($2::text[]))
      and ($3::timestamptz is null or (target.updated_at,target.id)<($3::timestamptz,$4))
      order by target.updated_at desc,target.id desc limit $5`,
      [scope, states, page.sort, page.id, page.fetch]
    );
    return this.enrich(context, result.rows, true);
  }

  async returns(context: ReadTransactionContext, scope: string, states: readonly string[], page: Parameters<StoreWorkRepository['returns']>[3]) {
    const result = await this.transactions.database(context).query(
      `${RETURN_SELECT}
      where (target.store_id=$1 or target.partner_id=$1)
      and (cardinality($2::text[])=0 or returned.state=any($2::text[]))
      and ($3::timestamptz is null or (returned.updated_at,returned.id)<($3::timestamptz,$4))
      order by returned.updated_at desc,returned.id desc limit $5`,
      [scope, states, page.sort, page.id, page.fetch]
    );
    return this.enrich(context, result.rows, false);
  }

  async transition(context: WriteTransactionContext, input: Parameters<StoreWorkRepository['transition']>[1]) {
    const database = this.transactions.database(context);
    const loaded = await this.scopes.fulfillment(context, input.id, input.scope);
    if (loaded.version !== input.expectedVersion) throw new DomainError('VERSION_CONFLICT');
    const next = FulfillmentState.from(loaded.state).transition(input.action);
    const changed = await database.query(
      `update fulfillment.fulfillmentorder set state=$2,version=version+1,updated_at=clock_timestamp()
      where id=$1 and state=$3 and version=$4 returning id`,
      [input.id, next, loaded.state, input.expectedVersion]
    );
    if (!changed.rows[0]) throw new DomainError('VERSION_CONFLICT');
    await database.query(
      `insert into fulfillment.storeaction(id,tenant_id,scope_id,fulfillment_id,action,state,note,actor_id,idempotency_key,occurred_at,version)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9,clock_timestamp(),1) on conflict(fulfillment_id,idempotency_key) do nothing`,
      [`storeaction:${fulfillmentDigest(`${input.id}:${input.idempotency}`)}`, context.tenant, input.scope, input.id, input.action, next, input.note, input.actor, input.idempotency]
    );
    await projectFulfillment(this.transactions, this.scopes.orders, context, input.id, loaded.order);
    return this.one(database, input.id, input.scope);
  }

  private async one(database: SqlExecutor, id: string, scope: string) {
    const result = await database.query(`${WORK_SELECT} where target.id=$1 and (target.store_id=$2 or target.partner_id=$2)`, [id, scope]);
    const row = result.rows[0];
    if (!row) throw new DomainError('RESOURCE_NOT_FOUND');
    const enriched = await this.enrich(database.transaction, [row], true);
    return enriched[0]!;
  }

  private async enrich(context: ReadTransactionContext, rows: readonly Record<string, unknown>[], includeLines: boolean) {
    const orderIds = [...new Set(rows.map((row) => text(row.order_id)).filter(Boolean))];
    const orders = await this.scopes.orders.storeWork(context, orderIds);
    const byId = new Map(orders.map((order) => [order.id, order]));
    return Object.freeze(
      rows.map((row) => {
        const order = byId.get(text(row.order_id));
        if (!order) throw new DomainError('RESOURCE_NOT_FOUND');
        const lines = includeLines ? mergeLines(row.lines, order.lines) : row.lines;
        return Object.freeze({ ...row, order_number: order.number, member_masked: memberMask(order.member), lines });
      })
    );
  }
}

const WORK_SELECT = `select target.id,target.order_id,target.suborder_id,target.provider,target.partner_id,target.store_id,target.kind,target.route,target.state,
target.external_reference,target.payment_id,target.source_effect_id,target.amount_minor::float8 amount_minor,target.idempotency_key,
target.created_at,target.updated_at,target.version::float8 version,
case when target.state in('failed','needsaction') then 'risk' when target.updated_at<clock_timestamp()-interval '2 hours'
and target.state not in('completed','cancelled') then 'overdue' else 'normal' end priority,
coalesce((select jsonb_agg(jsonb_build_object('line',line.order_line_id,
'quantity',line.quantity,'packed',coalesce((select sum(packed.quantity) from fulfillment.packageline packed join fulfillment.package package on package.id=packed.package_id
join fulfillment.shipment shipment on shipment.id=package.shipment_id where shipment.fulfillment_id=target.id and packed.order_line_id=line.order_line_id),0)) order by line.order_line_id)
from fulfillment.line line where line.fulfillment_id=target.id),'[]'::jsonb) lines
from fulfillment.fulfillmentorder target`;

const RETURN_SELECT = `select returned.id,returned.aftersale_id,returned.fulfillment_id,returned.scope_id,returned.state,returned.provider,
returned.provider_reference,returned.instruction,returned.tracking_number,returned.created_at,returned.updated_at,returned.version::float8 version,
coalesce((select jsonb_agg(jsonb_build_object('line',line.order_line_id,'quantity',line.quantity) order by line.order_line_id)
from fulfillment.returnline line where line.return_id=returned.id),'[]'::jsonb) lines,
coalesce((select jsonb_agg(jsonb_build_object('id',inspection.id,'sequence',inspection.sequence,'accepted',inspection.accepted,
'evidence',inspection.evidence,'actor',inspection.actor_id,'inspectedAt',inspection.inspected_at) order by inspection.sequence)
from fulfillment.inspection inspection where inspection.return_id=returned.id),'[]'::jsonb) inspections
from fulfillment.returnrecord returned join fulfillment.fulfillmentorder target on target.id=returned.fulfillment_id`;

function mergeLines(value: unknown, details: readonly Readonly<{ line: string; sku: string; title: string }>[]) {
  if (!Array.isArray(value)) throw new Error('FULFILLMENT_WORK_LINES_INVALID');
  const byId = new Map(details.map((line) => [line.line, line]));
  return Object.freeze(
    value.map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('FULFILLMENT_WORK_LINE_INVALID');
      const line = item as Record<string, unknown>;
      const detail = byId.get(text(line.line));
      if (!detail) throw new Error('FULFILLMENT_WORK_LINE_DETAIL_MISSING');
      return Object.freeze({ ...line, sku: detail.sku, title: detail.title });
    })
  );
}

function memberMask(value: string): string {
  return `会员 ${createHash('sha256').update(value).digest('hex').slice(-6)}`;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
