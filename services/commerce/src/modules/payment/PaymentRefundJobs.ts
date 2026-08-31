import { randomUUID } from 'node:crypto';
import type { DatabasePool } from '../../foundation/persistence/Pool';
import type { PaymentGateway } from './application/port/PaymentGateway';
import { RefundPlanner } from './application/RefundPlanner';
import { PaymentReference } from './domain/model/PaymentReference';
import { enqueuePaymentJob as enqueue, paymentDigest as digest, providerError as error, type IntentTarget, type ProviderObservation } from './PaymentJobSupport';
import type { PaymentJobDependencies } from './PaymentJobs';

export class PaymentRefundJobs {
  private readonly refunds: RefundPlanner;
  constructor(
    private readonly pool: DatabasePool,
    private readonly gateway: PaymentGateway,
    private readonly dependencies: PaymentJobDependencies
  ) {
    this.refunds = new RefundPlanner(dependencies.orders);
  }
  async resolveProviderRefund(selected: IntentTarget, observed: ProviderObservation): Promise<void> {
    const evidence = { intent: selected.intent, order: selected.order_id, providerState: observed.state, amountMinor: observed.amountMinor, transaction: observed.transaction ?? null, detectedAt: new Date().toISOString() };
    const recovery = `recovery:providerrefund:${selected.intent}`;
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      await client.query(
        `insert into payment.recoverycase(id,scope_id,order_id,resource_type,resource_id,severity,state,error_code,evidence,
        occurrence_count,opened_at) values($1,$2,$3,'intent',$4,'high','open','PAYMENT_PROVIDER_REFUNDED',$5::jsonb,1,clock_timestamp())
        on conflict(resource_type,resource_id) do update set occurrence_count=payment.recoverycase.occurrence_count+1,evidence=excluded.evidence`,
        [recovery, selected.scope_id, selected.order_id, selected.intent, JSON.stringify(evidence)]
      );
      await client.query(
        `insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,occurred_at,available_at)
        values($1,'payment.recovery.opened',1,'payment',$2,$3,$4::jsonb,$1,clock_timestamp(),clock_timestamp())`,
        [`event:${randomUUID()}`, selected.intent, selected.scope_id, JSON.stringify({ recovery, reason: 'PAYMENT_PROVIDER_REFUNDED', evidence })]
      );
      await client.query('commit');
    } catch (cause) {
      await client.query('rollback');
      throw cause;
    } finally {
      client.release();
    }
  }
  async createRefund(aftersale: string): Promise<string> {
    const id = `refund:${aftersale}`;
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const sale = await this.dependencies.orders.aftersale(client, aftersale, true);
      if (!sale || !afterSaleRefundRunnable(sale.state)) throw new Error('AFTERSALE_REFUND_NOT_RUNNABLE');
      const target = (
        await client.query<{ payment: string; available_minor: number }>(
          `select payment.id payment,(payment.captured_minor-payment.refunded_minor)::float8 available_minor
        from payment.intent intent join payment.payment payment on payment.intent_id=intent.id
        where intent.order_id=$1 and payment.captured_minor>payment.refunded_minor for update of payment`,
          [sale.order]
        )
      ).rows[0];
      if (!target) throw new Error('AFTERSALE_REFUND_NOT_RUNNABLE');
      const amountMinor = sale.amountMinor ?? target.available_minor;
      if (amountMinor <= 0 || amountMinor > target.available_minor) throw new Error('AFTERSALE_REFUND_NOT_RUNNABLE');
      const refund = await this.refunds.create(client, {
        id,
        payment: target.payment,
        amountMinor,
        idempotency: aftersale,
        reason: sale.reason,
        scope: sale.scope,
        scopes: Object.freeze([sale.scope]),
        aftersale,
      });
      await this.dependencies.orders.startAftersaleRefund(client, aftersale);
      await client.query('commit');
      return refund.id;
    } catch (cause) {
      await client.query('rollback');
      throw cause;
    } finally {
      client.release();
    }
  }
  async refund(refundid: string, worker: string): Promise<void> {
    const loaded = await this.pool.query<{
      id: string;
      payment_id: string;
      state: string;
      amount_minor: number;
      currency: string;
      reason: string;
      external_minor: number;
      external_total: number;
      transaction: string | null;
      order_id: string;
    }>(
      `select refund.id,refund.payment_id,refund.state,
      refund.amount_minor::float8 amount_minor,refund.currency,refund.reason,
      coalesce((select sum(leg.amount_minor) from payment.refundtender leg where leg.refund_id=refund.id and leg.kind='wechat'),0)::float8 external_minor,
      coalesce((select plan.amount_minor from payment.intenttender plan where plan.intent_id=intent.id and plan.kind='wechat'),0)::float8 external_total,
      (select attempt.external_transaction from payment.attempt attempt where attempt.intent_id=intent.id and attempt.provider='wechat'
      and attempt.state='succeeded' order by attempt.requested_at desc limit 1) transaction,intent.order_id
      from payment.refund refund join payment.payment payment on payment.id=refund.payment_id join payment.intent intent on intent.id=payment.intent_id
      where refund.id=$1 and refund.state in('requested','submitted','processing')`,
      [refundid]
    );
    const payment = loaded.rows[0];
    if (!payment) return;
    const order = await this.dependencies.orders.payment(this.pool, payment.order_id);
    if (!order) throw new Error('ORDER_NOT_FOUND');
    const selected = Object.freeze({ ...payment, scope_id: order.scope, member_id: order.member });
    if (selected.currency !== 'CNY') throw new Error('PAYMENT_CURRENCY_UNSUPPORTED');
    if (selected.external_minor === 0) return this.completeRefund(refundid, null);
    if (!selected.transaction || selected.external_total <= 0) throw new Error('PAYMENT_TRANSACTION_REFERENCE_MISSING');
    const sequence = await this.pool.query<{ sequence: number }>(`select coalesce(max(sequence),0)+1 sequence from payment.providerattempt where refund_id=$1`, [refundid]);
    const attempt = `providerattempt:${randomUUID()}`;
    await this.pool.query(
      `insert into payment.providerattempt(id,refund_id,sequence,operation,worker_id,outcome,started_at)
      values($1,$2,$3,$4,$5,'started',clock_timestamp())`,
      [attempt, refundid, sequence.rows[0]!.sequence, selected.state === 'requested' ? 'apply' : 'query', worker]
    );
    await this.dependencies.operations.record(this.pool, {
      id: `provideroperation:refund:${refundid}`,
      provider: 'wechat',
      scope: selected.scope_id,
      kind: 'refund',
      idempotency: refundid,
      reference: refundid,
      external: null,
      state: 'processing',
      requestHash: digest(`${refundid}:${selected.external_minor}:${selected.external_total}:${selected.currency}`),
      response: {},
    });
    let result: Readonly<{ state: 'processing' | 'succeeded' | 'failed'; reference: string }>;
    try {
      result =
        selected.state === 'requested'
          ? await this.gateway.refund({ refundNumber: PaymentReference.refund(refundid).text, transaction: selected.transaction, refundMinor: selected.external_minor, totalMinor: selected.external_total, reason: selected.reason })
          : await this.gateway.queryRefund(PaymentReference.refund(refundid).text);
      await this.pool.query(
        `with changed as(
        update payment.providerattempt set outcome='succeeded',provider_state=$2,provider_reference=$3,completed_at=clock_timestamp()
        where id=$1 returning refund_id)
        insert into payment.refundreceipt(id,refund_id,provider_attempt_id,scope_id,outcome,provider_state,provider_reference,receipt_hash,recorded_at)
        select $4,changed.refund_id,$1,$5,'succeeded',$2,$3,$6,clock_timestamp() from changed`,
        [attempt, result.state, result.reference, `refundreceipt:${attempt}`, selected.scope_id, digest(JSON.stringify(result))]
      );
      await this.dependencies.operations.update(this.pool, {
        provider: 'wechat',
        kind: 'refund',
        idempotency: refundid,
        external: result.reference,
        state: result.state === 'failed' ? 'failed' : result.state === 'succeeded' ? 'succeeded' : 'processing',
        response: result,
      });
    } catch (cause) {
      const failure = error(cause);
      await this.pool.query(
        `with changed as(
        update payment.providerattempt set outcome='unknown',error_code=$2,completed_at=clock_timestamp() where id=$1 returning refund_id)
        insert into payment.refundreceipt(id,refund_id,provider_attempt_id,scope_id,outcome,error_code,receipt_hash,recorded_at)
        select $3,changed.refund_id,$1,$4,'unknown',$2,$5,clock_timestamp() from changed`,
        [attempt, failure, `refundreceipt:${attempt}`, selected.scope_id, digest(failure)]
      );
      await this.dependencies.operations.update(this.pool, { provider: 'wechat', kind: 'refund', idempotency: refundid, state: 'unknown', response: { error: failure } });
      throw cause;
    }
    if (result.state === 'failed') {
      const client = await this.pool.connect();
      try {
        await client.query('begin');
        await client.query("update payment.refund set state='failed',external_transaction=$2,version=version+1 where id=$1 and state<>'succeeded'", [refundid, result.reference]);
        await client.query("update payment.refundtender set state='failed',provider_reference=case when kind='wechat' then $2 else null end where refund_id=$1 and state<>'succeeded'", [refundid, result.reference]);
        await client.query('commit');
      } catch (cause) {
        await client.query('rollback');
        throw cause;
      } finally {
        client.release();
      }
      return;
    }
    await this.pool.query(
      `with changed as(update payment.refund set state='processing',external_transaction=$2,version=version+1
      where id=$1 and state<>'succeeded' returning id) update payment.refundtender set state='processing',provider_reference=case when kind='wechat' then $2 else provider_reference end
      where refund_id=$1 and state='planned'`,
      [refundid, result.reference]
    );
    if (result.state === 'processing') {
      await enqueue(this.pool, 'paymentrefund', 'payment', selected.scope_id, { refund: refundid }, 30);
      return;
    }
    await this.completeRefund(refundid, result.reference);
  }
  async completeRefund(refundid: string, reference: string | null): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      await this.dependencies.refundSettlement.complete(client, refundid, reference);
      await client.query('commit');
    } catch (cause) {
      await client.query('rollback');
      throw cause;
    } finally {
      client.release();
    }
  }
}

export function afterSaleRefundRunnable(state: string): boolean {
  return state === 'refunding';
}
