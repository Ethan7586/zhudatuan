import { randomUUID } from 'node:crypto';
import { PgRuntimeWriter } from '../../../../adapter/database/PgRuntimeWriter';
import type { SqlExecutor } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import { OrderPaymentPort } from './OrderPaymentPort';
import type { AfterSaleReturnEvidence } from '../../public';
export class OrderAfterSalePort extends OrderPaymentPort {
  async startAftersaleRefund(context: WriteTransactionContext, aftersale: string): Promise<void> {
    const database = this.transactions.database(context);
    const changed = await database.query(`select id from ordering.aftersale where id=$1 and state='refunding' for update`, [aftersale]);
    if (!changed.rows[0]) throw new Error('AFTERSALE_STATE_CONFLICT');
  }
  async markRefunded(
    context: WriteTransactionContext,
    input: Readonly<{
      order: string;
      refundedMinor: number;
      capturedMinor: number;
      aftersale: string | null;
    }>
  ): Promise<void> {
    const database = this.transactions.database(context);
    const changed = await database.query(
      `update ordering.orderrecord set payment_state=case when $2=$3 then 'refunded' else 'partially_refunded' end,
      aftersale_state=case when $4::text is null then aftersale_state else 'resolved' end,version=version+1,updated_at=clock_timestamp()
      where id=$1 returning id`,
      [input.order, input.refundedMinor, input.capturedMinor, input.aftersale]
    );
    if (!changed.rows[0]) throw new Error('ORDER_NOT_FOUND');
    if (!input.aftersale) return;
    const resolved = await database.query(
      `with changed as(update ordering.aftersale set state='resolved',version=version+1,updated_at=clock_timestamp()
      where id=$1 and state='refunding' returning id,order_id)
      insert into ordering.aftersaletimeline(id,aftersale_id,sequence,kind,previous_state,next_state,actor_id,evidence,occurred_at)
      select 'timeline:'||gen_random_uuid()::text,$1,coalesce(max(timeline.sequence),0)+1,'refund','refunding','resolved',
        'payment:refund',jsonb_build_object('refundedMinor',$2),clock_timestamp()
      from changed left join ordering.aftersaletimeline timeline on timeline.aftersale_id=changed.id group by changed.id returning aftersale_id`,
      [input.aftersale, input.refundedMinor]
    );
    if (!resolved.rows[0]) throw new Error('AFTERSALE_STATE_CONFLICT');
    const order = await database.query<{
      scope_id: string;
      member_id: string;
    }>('select scope_id,member_id from ordering.orderrecord where id=$1', [input.order]);
    const snapshot = order.rows[0];
    if (!snapshot) throw new Error('ORDER_NOT_FOUND');
    await new PgRuntimeWriter(database).append({
      id: `event:${randomUUID()}`,
      type: 'aftersale.changed',
      aggregateType: 'aftersale',
      aggregate: input.aftersale,
      scope: snapshot.scope_id,
      payload: { aftersale: input.aftersale, order: input.order, member: snapshot.member_id, previousState: 'refunding', state: 'resolved' },
      trace: 'payment:refund',
    });
  }
  async returnRequest(context: ReadTransactionContext, aftersale: string) {
    const database = this.transactions.database(context);
    const result = await database.query<{
      id: string;
      order: string;
      scope: string;
      member: string;
      reason: string;
      state: string;
      requiresReturn: boolean;
      lines: unknown;
    }>(
      `select aftersale.id,aftersale.order_id "order",orders.scope_id scope,orders.member_id member,aftersale.reason_code reason,aftersale.state,
      aftersale.requires_return "requiresReturn",coalesce(jsonb_agg(jsonb_build_object('line',line.line_id,
        'quantity',line.requested_quantity,'provider',line.provider,'policy',line.policy_snapshot) order by line.line_id),'[]') lines
      from ordering.aftersale aftersale join ordering.orderrecord orders on orders.id=aftersale.order_id
      join ordering.aftersaleline line on line.aftersale_id=aftersale.id where aftersale.id=$1 group by aftersale.id,orders.id`,
      [aftersale]
    );
    const row = result.rows[0];
    if (!row) return null;
    const lines = (Array.isArray(row.lines) ? row.lines : []).flatMap((value) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
      const item = value as Record<string, unknown>;
      return typeof item.line === 'string' && Number.isSafeInteger(Number(item.quantity))
        ? [
            Object.freeze({
              line: item.line,
              quantity: Number(item.quantity),
              provider: typeof item.provider === 'string' ? item.provider : null,
              policy: item.policy && typeof item.policy === 'object' && !Array.isArray(item.policy) ? Object.freeze(item.policy as Record<string, unknown>) : Object.freeze({}),
            }),
          ]
        : [];
    });
    return Object.freeze({ ...row, lines: Object.freeze(lines) });
  }
  markReturning(context: WriteTransactionContext, aftersale: string, returns: readonly AfterSaleReturnEvidence[], actor: string): Promise<void> {
    const database = this.transactions.database(context);
    return this.transition(database, aftersale, 'approved', 'returning', 'returnauthorized', actor, { returns });
  }
  markReceived(context: WriteTransactionContext, aftersale: string, returns: readonly AfterSaleReturnEvidence[], actor: string): Promise<void> {
    const database = this.transactions.database(context);
    return this.transition(database, aftersale, 'returning', 'received', 'returnreceived', actor, { returns });
  }
  markRefunding(context: WriteTransactionContext, aftersale: string, returns: readonly AfterSaleReturnEvidence[], actor: string): Promise<void> {
    const database = this.transactions.database(context);
    return this.transition(database, aftersale, 'received', 'refunding', 'returnaccepted', actor, { returns });
  }
  async recordInspection(context: WriteTransactionContext, aftersale: string, returned: string, accepted: boolean, actor: string): Promise<void> {
    const database = this.transactions.database(context);
    if (!accepted)
      await database.query(
        `update ordering.aftersale set unavailable_reason='INSPECTION_REJECTED',version=version+1,updated_at=clock_timestamp()
        where id=$1 and state='received'`,
        [aftersale]
      );
    await database.query(
      `insert into ordering.aftersaletimeline(id,aftersale_id,sequence,kind,previous_state,next_state,actor_id,evidence,occurred_at)
      select 'timeline:'||gen_random_uuid()::text,$1,coalesce(max(timeline.sequence),0)+1,'inspection',aftersale.state,aftersale.state,$3,
        jsonb_build_object('return',$2,'accepted',$4),clock_timestamp() from ordering.aftersale aftersale
      left join ordering.aftersaletimeline timeline on timeline.aftersale_id=aftersale.id
      where aftersale.id=$1 group by aftersale.id`,
      [aftersale, returned, actor, accepted]
    );
  }
  private async transition(database: SqlExecutor, aftersale: string, previous: string, next: string, kind: string, actor: string, evidence: unknown): Promise<void> {
    const changed = await database.query<{
      order_id: string;
      scope_id: string;
      member_id: string;
    }>(
      `update ordering.aftersale aftersale set state=$3,version=version+1,updated_at=clock_timestamp()
      from ordering.orderrecord orders where aftersale.id=$1 and aftersale.state=$2 and orders.id=aftersale.order_id
      returning aftersale.order_id,orders.scope_id,orders.member_id`,
      [aftersale, previous, next]
    );
    const row = changed.rows[0];
    if (!row) throw new Error('AFTERSALE_STATE_CONFLICT');
    await database.query(`update ordering.orderrecord set aftersale_state=$2,version=version+1,updated_at=clock_timestamp() where id=$1`, [row.order_id, next]);
    await database.query(
      `insert into ordering.aftersaletimeline(id,aftersale_id,sequence,kind,previous_state,next_state,actor_id,evidence,occurred_at)
      select 'timeline:'||gen_random_uuid()::text,$1,coalesce(max(sequence),0)+1,$2,$3,$4,$5,$6::jsonb,clock_timestamp()
      from ordering.aftersaletimeline where aftersale_id=$1`,
      [aftersale, kind, previous, next, actor, JSON.stringify(evidence)]
    );
    const runtime = new PgRuntimeWriter(database);
    await runtime.append({
      id: `event:${randomUUID()}`,
      type: 'aftersale.changed',
      aggregateType: 'aftersale',
      aggregate: aftersale,
      scope: row.scope_id,
      payload: { aftersale, order: row.order_id, member: row.member_id, previousState: previous, state: next },
      trace: actor,
    });
    if (next === 'refunding') await runtime.schedule({ id: `job:refund:${aftersale}`, kind: 'paymentrefund', owner: 'payment', scope: row.scope_id, payload: { aftersale }, priority: 10 });
  }
}
