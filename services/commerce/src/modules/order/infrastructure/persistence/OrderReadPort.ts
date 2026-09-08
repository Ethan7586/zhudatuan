import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import { Money } from '@shop/kernel';
import { PgRuntimeWriter } from '../../../../platform/database/PgRuntimeWriter';
import { OrderProjectionPort } from './OrderProjectionPort';
import { nextOrderNumber } from './OrderNumber';
import type { CreateOrderIntent } from '../../public/OrderIntentPort';
import { DomainError } from '../../../../platform/error/DomainError';
export class OrderReadPort extends OrderProjectionPort {
  async purchases(context: ReadTransactionContext, member: string) {
    const database = this.transactions.database(context);
    const result = await database.query<{
      listing: string;
      dayQuantity: number;
      weekQuantity: number;
      monthQuantity: number;
      lifetimeQuantity: number;
      dayMinor: number;
      weekMinor: number;
      monthMinor: number;
      lifetimeMinor: number;
    }>(
      `select line.listing_id listing,
      coalesce(sum(line.quantity) filter(where orders.created_at>=date_trunc('day',clock_timestamp())),0)::float8 "dayQuantity",
      coalesce(sum(line.quantity) filter(where orders.created_at>=date_trunc('week',clock_timestamp())),0)::float8 "weekQuantity",
      coalesce(sum(line.quantity) filter(where orders.created_at>=date_trunc('month',clock_timestamp())),0)::float8 "monthQuantity",
      coalesce(sum(line.quantity),0)::float8 "lifetimeQuantity",
      coalesce(sum(line.payable_minor) filter(where orders.created_at>=date_trunc('day',clock_timestamp())),0)::float8 "dayMinor",
      coalesce(sum(line.payable_minor) filter(where orders.created_at>=date_trunc('week',clock_timestamp())),0)::float8 "weekMinor",
      coalesce(sum(line.payable_minor) filter(where orders.created_at>=date_trunc('month',clock_timestamp())),0)::float8 "monthMinor",
      coalesce(sum(line.payable_minor),0)::float8 "lifetimeMinor"
      from ordering.orderrecord orders join ordering.line line on line.order_id=orders.id
      where orders.member_id=$1 and orders.lifecycle_state not in('cancelled','closed') group by line.listing_id`,
      [member]
    );
    return Object.freeze(result.rows.map((row) => Object.freeze(row)));
  }
  async snapshot(context: ReadTransactionContext, order: string) {
    const database = this.transactions.database(context);
    const result = await database.query<{
      id: string;
      scope: string;
      member: string;
    }>(`select id,scope_id scope,member_id member from ordering.orderrecord where id=$1`, [order]);
    const row = result.rows[0];
    return row ? Object.freeze(row) : null;
  }
  async fulfillment(context: ReadTransactionContext, order: string) {
    const database = this.transactions.database(context);
    const result = await database.query<{
      suborder: string;
      provider: string | null;
      partner: string | null;
      lines: unknown;
    }>(
      `select suborder.id suborder,suborder.provider,suborder.partner_id partner,
      jsonb_agg(jsonb_build_object('line',line.id,'quantity',line.quantity,'payableMinor',line.payable_minor,
        'productType',coalesce(line.evidence->>'productType','physical')) order by line.id) lines
      from ordering.suborder suborder join ordering.line line on line.order_id=suborder.order_id
        and line.provider is not distinct from suborder.provider and line.partner_id is not distinct from suborder.partner_id
      where suborder.order_id=$1 group by suborder.id,suborder.provider,suborder.partner_id order by suborder.id`,
      [order]
    );
    const plans = result.rows.map((row) =>
      Object.freeze({
        ...row,
        lines: Object.freeze(
          (Array.isArray(row.lines) ? row.lines : []).flatMap((value) => {
            if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
            const line = (value as Record<string, unknown>).line;
            const quantity = Number((value as Record<string, unknown>).quantity);
            const payableMinor = Number((value as Record<string, unknown>).payableMinor);
            const productType = (value as Record<string, unknown>).productType;
            return typeof line === 'string' && Number.isSafeInteger(quantity) && quantity > 0 && Number.isSafeInteger(payableMinor) && payableMinor >= 0 && typeof productType === 'string'
              ? [Object.freeze({ line, quantity, payableMinor, productType })]
              : [];
          })
        ),
      })
    );
    if (plans.length === 0 || plans.some((plan) => plan.lines.length === 0)) throw new Error('ORDER_FULFILLMENT_PLAN_EMPTY');
    return Object.freeze(plans);
  }
  async lineSkus(context: ReadTransactionContext, order: string, lines: readonly string[]) {
    const database = this.transactions.database(context);
    if (lines.length === 0) return Object.freeze([]);
    const result = await database.query<{
      line: string;
      sku: string;
      product: string;
    }>(`select id line,sku_id sku,evidence->>'product' product from ordering.line where order_id=$1 and id=any($2::text[]) order by id`, [order, lines]);
    if (result.rows.some(({ product }) => !product)) throw new Error('ORDER_FULFILLMENT_PRODUCT_MISSING');
    return Object.freeze(result.rows.map((row) => Object.freeze(row)));
  }
  async storeWork(context: ReadTransactionContext, orders: readonly string[]) {
    if (orders.length === 0) return Object.freeze([]);
    const result = await this.transactions.database(context).query<{ id: string; number: string; member: string; lines: unknown }>(
      `select orders.id,orders.order_number number,orders.member_id member,
      coalesce(jsonb_agg(jsonb_build_object('line',line.id,'sku',line.sku_id,'title',line.title_snapshot)
        order by line.id) filter(where line.id is not null),'[]'::jsonb) lines
      from ordering.orderrecord orders left join ordering.line line on line.order_id=orders.id
      where orders.id=any($1::text[]) group by orders.id,orders.order_number,orders.member_id order by orders.id`,
      [orders]
    );
    return Object.freeze(result.rows.map((row) => Object.freeze({ ...row, lines: storeLines(row.lines) })));
  }
}

function storeLines(value: unknown): readonly Readonly<{ line: string; sku: string; title: string }>[] {
  if (!Array.isArray(value)) throw new Error('ORDER_STORE_WORK_LINES_INVALID');
  return Object.freeze(
    value.map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('ORDER_STORE_WORK_LINE_INVALID');
      const source = item as Record<string, unknown>;
      if (typeof source.line !== 'string' || typeof source.sku !== 'string' || typeof source.title !== 'string') throw new Error('ORDER_STORE_WORK_LINE_INVALID');
      return Object.freeze({ line: source.line, sku: source.sku, title: source.title });
    })
  );
}
