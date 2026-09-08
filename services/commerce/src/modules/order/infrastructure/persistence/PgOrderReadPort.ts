import type { QueryResultRow } from 'pg';
import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import type { ReadTransactionContext } from '../../../../platform/database/TransactionContext';
import type { OrderSummary, OrderReadPort } from '../../public/OrderReadPort';
import type { TransactionManager } from '../../../../platform/database/TransactionManager';
interface OrderRow extends QueryResultRow {
  readonly total: number;
  readonly awaiting_payment: number;
  readonly fulfilling: number;
  readonly aftersale: number;
  readonly version: number;
}
export class PgOrderReadPort implements OrderReadPort {
  constructor(
    private readonly manager: TransactionManager,
    private readonly transactions = new PgTransactionAccess()
  ) {}
  async summary(context: ReadTransactionContext, member: string, mall: string): Promise<OrderSummary> {
    const database = this.transactions.database(context);
    const result = await database.query<OrderRow>(
      `select count(*)::integer total,count(*) filter(where lifecycle_state='awaitingpayment')::integer awaiting_payment,
        count(*) filter(where lifecycle_state in('paid','fulfilling','shipped'))::integer fulfilling,
        count(*) filter(where aftersale_state not in('none','resolved','rejected'))::integer aftersale,
        coalesce(max(version),0)::bigint version from ordering.orderrecord where member_id=$1 and mall_id=$2`,
      [member, mall]
    );
    const row = result.rows[0]!;
    return Object.freeze({ total: Number(row.total), awaitingPayment: Number(row.awaiting_payment), fulfilling: Number(row.fulfilling), aftersale: Number(row.aftersale), version: Number(row.version) });
  }
  resolveScope(order: string, signal: AbortSignal, deadline: number): Promise<string | null> {
    return this.manager.read({ tenant: '', membership: '', scope: 'public:ordering:webhook', actor: 'provider:wechat', trace: `webhookscope:${order}`, operation: 'order.read.scope', signal, deadline }, async (context) => {
      const result = await this.transactions.database(context).query<{ scope: string | null }>('select ordering.payment_webhook_scope($1::text) scope', [order]);
      return result.rows[0]?.scope ?? null;
    });
  }
}
