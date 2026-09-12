import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';

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
    const changed = await database.query(`with transitioned as(
      update ordering.aftersale set state='processing',version=version+1,updated_at=clock_timestamp()
      where id=$1 and state='approved' returning id)
      select id from transitioned union all select id from ordering.aftersale where id=$1 and state='processing' limit 1`, [aftersale]);
    if (!changed.rows[0]) throw new Error('AFTERSALE_STATE_CONFLICT');
  }

  async markRefunded(database: OperationDatabase, input: Readonly<{ order: string; refundedMinor: number; capturedMinor: number;
    aftersale: string | null }>): Promise<void> {
    const changed = await database.query(`update ordering.orderrecord set payment_state=case when $2::bigint=$3::bigint then 'refunded' else 'partially_refunded' end,
      aftersale_state=case when $4::text is null then aftersale_state else 'resolved' end,version=version+1,updated_at=clock_timestamp()
      where id=$1 returning id`, [input.order, input.refundedMinor, input.capturedMinor, input.aftersale]);
    if (!changed.rows[0]) throw new Error('ORDER_NOT_FOUND');
    if (input.aftersale) await database.query(`update ordering.aftersale set state='completed',version=version+1,updated_at=clock_timestamp()
      where id=$1 and state in('approved','processing')`, [input.aftersale]);
  }

  async prepareSupplierAftersaleReplay(database: OperationDatabase, aftersale: string, refund: string): Promise<boolean> {
    const target = await database.query<{ order_line_id: string; supplier_leg_id: string }>(`select line.id order_line_id,line.supplier_leg_id
      from ordering.aftersale aftersale join ordering.line line on line.id=aftersale.line_id and line.order_id=aftersale.order_id
      where aftersale.id=$1 for update of aftersale`, [aftersale]);
    const row = target.rows[0];
    if (!row || !row.supplier_leg_id) {
      await database.query(`insert into ordering.aftersaleexception(id,aftersale_id,supplier_leg_id,reason,state,evidence,created_at)
        values('aftersale-exception:'||$1,$1,$2,'ORIGINAL_ROUTE_UNAVAILABLE','pending',jsonb_build_object('refund',$3::text),clock_timestamp())
        on conflict(aftersale_id,reason) do nothing`, [aftersale, row?.supplier_leg_id ?? null, refund]);
      await database.query("update ordering.aftersale set replay_state='exception' where id=$1", [aftersale]);
      return false;
    }
    const inserted = await database.query(`insert into ordering.aftersaleroutestep(aftersale_id,order_line_id,reverse_sequence_no,
      original_sequence_no,route_id,route_version,party_id,party_kind,responsibility,created_at)
      select $1,step.order_line_id,row_number() over(order by step.sequence_no desc),step.sequence_no,step.route_id,step.route_version,
        step.party_id,step.party_kind,case step.party_kind when 'supplier' then 'return_refund_restock_reversal'
          when 'operating_owner' then 'refund_reconciliation' else 'participant_return' end,clock_timestamp()
      from ordering.lineroutestep step where step.order_line_id=$2 order by step.sequence_no desc
      on conflict(aftersale_id,order_line_id,reverse_sequence_no) do nothing returning original_sequence_no`, [aftersale, row.order_line_id]);
    if (inserted.rows.length === 0) {
      const existing = await database.query(`select 1 from ordering.aftersaleroutestep where aftersale_id=$1 and order_line_id=$2`,
      [aftersale, row.order_line_id]);
      if (!existing.rows[0]) {
        await database.query(`insert into ordering.aftersaleexception(id,aftersale_id,supplier_leg_id,reason,state,evidence,created_at)
          values('aftersale-exception:'||$1,$1,$2,'ORIGINAL_ROUTE_UNAVAILABLE','pending',jsonb_build_object('refund',$3::text),clock_timestamp())
          on conflict(aftersale_id,reason) do nothing`, [aftersale, row.supplier_leg_id, refund]);
        await database.query("update ordering.aftersale set replay_state='exception' where id=$1", [aftersale]);
        return false;
      }
    }
    await database.query("update ordering.aftersale set replay_state='processing' where id=$1 and replay_state='pending'", [aftersale]);
    return true;
  }

  async completeSupplierAftersaleReplay(database: OperationDatabase, aftersale: string): Promise<void> {
    await database.query("update ordering.aftersale set replay_state='completed' where id=$1 and replay_state='processing'", [aftersale]);
  }

  async completeFulfillment(database: OperationDatabase, order: string): Promise<boolean> {
    const changed = await database.query(`update ordering.orderrecord set fulfillment_state='delivered',lifecycle_state='completed',
      version=version+1,updated_at=clock_timestamp() where id=$1 and fulfillment_state<>'delivered'
      and not exists(select 1 from fulfillment.fulfillmentorder where order_id=$1 and state<>'completed') returning id`, [order]);
    if (changed.rows[0]) return true;
    const existing = await database.query(`select 1 from ordering.orderrecord where id=$1`, [order]);
    if (!existing.rows[0]) throw new Error('ORDER_NOT_FOUND');
    return false;
  }
}

export const orderPort = new OrderPort();
