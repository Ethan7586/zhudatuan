import type { SqlExecutor } from '../../../../platform/database/PgTransactionAccess';
import { orderTime } from '../../application/model/OrderTime';
import { ORDER_READ_FILTER_SQL, orderExceptionSql } from './OrderReadSql';

export async function orderFacets(database: SqlExecutor, values: readonly unknown[], signal: AbortSignal) {
  try {
    const result = await database.query<{
      all: number;
      unpaid: number;
      unshipped: number;
      active: number;
      completed: number;
      aftersale: number;
      exception: number;
      orderWatermark: Date | null;
      paymentWatermark: Date | null;
      fulfillmentWatermark: Date | null;
      aftersaleWatermark: Date | null;
      refundWatermark: Date | null;
    }>(
      `with visible as materialized (
        select orders.id,orders.updated_at,orders.payment_state,orders.fulfillment_state,orders.aftersale_state,
          orders.lifecycle_state,orders.verification_state
        from ordering.orderrecord orders where (
          ($1::boolean and orders.member_id=$2) or (($3 or $4) and exists(select 1 from ordering.suborder where order_id=orders.id and partner_id=$2))
          or (not $1::boolean and not $3 and not $4 and orders.scope_id=any($5::text[]))
        ) ${ORDER_READ_FILTER_SQL}
      )
      select count(*)::float8 all,
        count(*) filter(where payment_state in('unpaid','authorizing'))::float8 unpaid,
        count(*) filter(where payment_state in('paid','partially_refunded') and fulfillment_state in('unallocated','allocated'))::float8 unshipped,
        count(*) filter(where lifecycle_state<>'cancelled' and fulfillment_state in('processing','shipped','delivered'))::float8 active,
        count(*) filter(where lifecycle_state='completed')::float8 completed,
        count(*) filter(where aftersale_state<>'none')::float8 aftersale,
        count(*) filter(where ${orderExceptionSql('visible')})::float8 exception,
        max(updated_at) "orderWatermark",
        (select max(payment.updated_at) from ordering.paymentread payment join visible on visible.id=payment.order_id) "paymentWatermark",
        (select max(fulfillment.updated_at) from ordering.fulfillmentread fulfillment join visible on visible.id=fulfillment.order_id) "fulfillmentWatermark",
        (select max(aftersale.updated_at) from ordering.aftersale aftersale join visible on visible.id=aftersale.order_id) "aftersaleWatermark",
        (select max(refund.updated_at) from ordering.refundread refund join visible on visible.id=refund.order_id) "refundWatermark"
      from visible`,
      values
    );
    const row = result.rows[0];
    if (!row) throw new Error('ORDER_FACET_PROJECTION_MISSING');
    return Object.freeze({
      state: 'ready' as const,
      data: Object.freeze({
        counts: Object.freeze({ all: row.all, unpaid: row.unpaid, unshipped: row.unshipped, active: row.active, completed: row.completed, aftersale: row.aftersale, exception: row.exception }),
        watermarks: Object.freeze({
          order: orderTime(row.orderWatermark),
          payment: orderTime(row.paymentWatermark),
          fulfillment: orderTime(row.fulfillmentWatermark),
          aftersale: orderTime(row.aftersaleWatermark),
          refund: orderTime(row.refundWatermark),
        }),
      }),
    });
  } catch (cause) {
    if (signal.aborted) throw signal.reason ?? cause;
    return Object.freeze({ state: 'unavailable' as const, error: Object.freeze({ code: 'ORDER_FACET_UNAVAILABLE', message: '订单状态统计与数据水位暂时不可用，列表仍可继续使用。', retryable: true }) });
  }
}
