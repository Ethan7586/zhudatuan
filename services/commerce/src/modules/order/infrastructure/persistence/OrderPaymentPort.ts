import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
/** Order-owned payment views; callers never traverse Ordering repositories or tables. */
export class OrderPaymentPort {
  protected readonly transactions = new PgTransactionAccess();
  payment(context: ReadTransactionContext, order: string, member?: string) {
    return this.paymentRecord(this.transactions.database(context), order, member, false);
  }
  lockPayment(context: WriteTransactionContext, order: string, member?: string) {
    return this.paymentRecord(this.transactions.database(context), order, member, true);
  }
  private async paymentRecord(database: import('../../../../adapter/database/PgTransactionAccess').SqlExecutor, order: string, member: string | undefined, lock: boolean) {
    const result = await database.query<{
      id: string;
      number: string;
      scope: string;
      mall: string;
      member: string;
      currency: string;
      totalMinor: number;
      paymentState: string;
      lifecycleState: string;
    }>(
      `select id,order_number number,scope_id scope,mall_id mall,member_id member,currency,
      total_minor::float8 "totalMinor",payment_state "paymentState",lifecycle_state "lifecycleState"
      from ordering.orderrecord where id=$1 and ($2::text is null or member_id=$2)${lock ? ' for update' : ''}`,
      [order, member ?? null]
    );
    const row = result.rows[0];
    return row ? Object.freeze(row) : null;
  }
  aftersale(context: ReadTransactionContext, aftersale: string) {
    return this.afterSaleRecord(this.transactions.database(context), aftersale, false);
  }
  lockAfterSale(context: WriteTransactionContext, aftersale: string) {
    return this.afterSaleRecord(this.transactions.database(context), aftersale, true);
  }
  private async afterSaleRecord(database: import('../../../../adapter/database/PgTransactionAccess').SqlExecutor, aftersale: string, lock: boolean) {
    const result = await database.query<{
      id: string;
      order: string;
      scope: string;
      mall: string;
      member: string;
      line: string | null;
      amountMinor: number | null;
      reason: string;
      state: string;
    }>(
      `select aftersale.id,aftersale.order_id "order",orders.scope_id scope,orders.mall_id mall,
      orders.member_id member,(select min(line.line_id) from ordering.aftersaleline line where line.aftersale_id=aftersale.id) line,
      aftersale.expected_refund_minor::float8 "amountMinor",aftersale.description reason,aftersale.state from ordering.aftersale aftersale
      join ordering.orderrecord orders on orders.id=aftersale.order_id where aftersale.id=$1${lock ? ' for update of aftersale' : ''}`,
      [aftersale]
    );
    const row = result.rows[0];
    return row ? Object.freeze(row) : null;
  }
  async numbers(context: ReadTransactionContext, orders: readonly string[]): Promise<Readonly<Record<string, string>>> {
    const database = this.transactions.database(context);
    if (orders.length === 0) return Object.freeze({});
    const result = await database.query<{
      id: string;
      number: string;
    }>(`select id,order_number number from ordering.orderrecord where id=any($1::text[]) order by id`, [orders]);
    return Object.freeze(Object.fromEntries(result.rows.map(({ id, number }) => [id, number])));
  }
}
