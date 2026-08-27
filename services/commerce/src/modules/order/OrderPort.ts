import type { OperationDatabase } from '../../foundation/application/ModuleOperations';

export class OrderPort {
  async paymentState(database: OperationDatabase, order: string): Promise<string> {
    const selected = await database.query<{ payment_state: string }>(`select payment_state from ordering.orderrecord where id=$1 for update`, [order]);
    const state = selected.rows[0]?.payment_state;
    if (!state) throw new Error('ORDER_NOT_FOUND');
    return state;
  }

  async markAuthorizing(database: OperationDatabase, order: string): Promise<void> {
    const changed = await database.query(`update ordering.orderrecord set payment_state='authorizing',version=version+1,updated_at=clock_timestamp()
      where id=$1 and payment_state='unpaid' returning id`, [order]);
    if (!changed.rows[0]) throw new Error('ORDER_PAYMENT_STATE_CONFLICT');
  }

  async markPaid(database: OperationDatabase, order: string): Promise<void> {
    const changed = await database.query(`update ordering.orderrecord set payment_state='paid',lifecycle_state='active',fulfillment_state='allocated',
      version=version+1,updated_at=clock_timestamp() where id=$1 and payment_state in('unpaid','authorizing') returning id`, [order]);
    if (!changed.rows[0]) throw new Error('ORDER_PAYMENT_STATE_CONFLICT');
  }

  async markLatePaid(database: OperationDatabase, order: string): Promise<void> {
    const changed = await database.query(`update ordering.orderrecord set payment_state='paid',version=version+1,updated_at=clock_timestamp()
      where id=$1 returning id`, [order]);
    if (!changed.rows[0]) throw new Error('ORDER_NOT_FOUND');
  }

  async cancelUnpaid(database: OperationDatabase, order: string): Promise<void> {
    const changed = await database.query(`update ordering.orderrecord set lifecycle_state='cancelled',fulfillment_state='cancelled',
      version=version+1,updated_at=clock_timestamp() where id=$1 and payment_state in('unpaid','authorizing') returning id`, [order]);
    if (!changed.rows[0]) throw new Error('ORDER_PAYMENT_STATE_CONFLICT');
  }

  async resetPayment(database: OperationDatabase, order: string): Promise<void> {
    const changed = await database.query(`update ordering.orderrecord set payment_state='unpaid',version=version+1,updated_at=clock_timestamp()
      where id=$1 and payment_state='authorizing' returning id`, [order]);
    if (!changed.rows[0]) throw new Error('ORDER_PAYMENT_STATE_CONFLICT');
  }

  async startAftersaleRefund(database: OperationDatabase, aftersale: string): Promise<void> {
    const changed = await database.query(`update ordering.aftersale set state='processing',version=version+1,updated_at=clock_timestamp()
      where id=$1 and state='approved' returning id`, [aftersale]);
    if (!changed.rows[0]) throw new Error('AFTERSALE_STATE_CONFLICT');
  }

  async markRefunded(database: OperationDatabase, input: Readonly<{ order: string; refundedMinor: number; capturedMinor: number;
    aftersale: string | null }>): Promise<void> {
    const changed = await database.query(`update ordering.orderrecord set payment_state=case when $2=$3 then 'refunded' else 'partially_refunded' end,
      aftersale_state=case when $4::text is null then aftersale_state else 'resolved' end,version=version+1,updated_at=clock_timestamp()
      where id=$1 returning id`, [input.order, input.refundedMinor, input.capturedMinor, input.aftersale]);
    if (!changed.rows[0]) throw new Error('ORDER_NOT_FOUND');
    if (input.aftersale) await database.query(`update ordering.aftersale set state='completed',version=version+1,updated_at=clock_timestamp()
      where id=$1 and state in('approved','processing')`, [input.aftersale]);
  }

  async completeFulfillment(database: OperationDatabase, order: string): Promise<void> {
    const changed = await database.query(`update ordering.orderrecord set fulfillment_state='delivered',lifecycle_state='completed',
      version=version+1,updated_at=clock_timestamp() where id=$1 returning id`, [order]);
    if (!changed.rows[0]) throw new Error('ORDER_NOT_FOUND');
  }
}

export const orderPort = new OrderPort();
