import { randomUUID } from 'node:crypto';
import type { ClaimedJob, JobProcessor } from '../../foundation/application/JobRunner';
import type { DatabasePool } from '../../foundation/persistence/Pool';
import type { PaymentGateway } from './application/port/PaymentGateway';
import { PaymentReference } from './domain/model/PaymentReference';
import { PaymentSettlement, releaseOrderHolds } from './application/PaymentSettlement';
import { RefundPlanner } from './application/RefundPlanner';
import { RefundSettlement } from './application/RefundSettlement';
import { PaymentLifecycle } from './domain/policy/PaymentLifecycle';
import { assertProviderAmount, enqueuePaymentJob as enqueue, intentExpired, jobPayload as object, jobText as text, paymentDigest as digest,
  paymentApplication, providerError as error, recordProviderObservation, type IntentTarget, type ProviderObservation } from './PaymentJobSupport';
import { orderPort } from '../order/OrderModule';
import { channelOperationPort } from '../channel/ChannelModule';

export class PaymentJobProcessor implements JobProcessor {
  private readonly settlement = new PaymentSettlement();
  private readonly refunds = new RefundPlanner();
  private readonly refundSettlement = new RefundSettlement();
  private readonly lifecycle = new PaymentLifecycle();
  constructor(private readonly pool: DatabasePool, private readonly gateway: PaymentGateway, private readonly kind: 'paymentquery' | 'paymentrefund') {}

  async process(job: ClaimedJob, signal: AbortSignal): Promise<void> {
    if (job.kind !== this.kind) throw new Error('JOB_KIND_MISMATCH');
    if (signal.aborted) throw signal.reason;
    const payload = object(job.payload);
    if (this.kind === 'paymentquery') {
      await this.query(text(payload.intent, 'PAYMENT_INTENT_REQUIRED'));
      if (payload.providerEvent) await this.completeEvent(text(payload.providerEvent, 'PAYMENT_PROVIDER_EVENT_INVALID'));
      return;
    }
    const refund = payload.refund ? text(payload.refund, 'PAYMENT_REFUND_REQUIRED') : await this.createRefund(text(payload.aftersale, 'AFTERSALE_REQUIRED'));
    await this.refund(refund, job.id);
    if (payload.providerEvent) await this.completeEvent(text(payload.providerEvent, 'PAYMENT_PROVIDER_EVENT_INVALID'));
  }

  private async query(intentid: string): Promise<void> {
    const loaded = await this.pool.query<IntentTarget>(`select intent.id intent,intent.order_id,orders.order_number,orders.scope_id,orders.mall_id,
      orders.member_id,intent.amount_minor::float8 amount_minor,plan.amount_minor::float8 provider_minor,intent.currency,intent.state intent_state,attempt.id attempt,intent.expires_at,
      attempt.scene,attempt.application_hash
      from payment.intent intent join ordering.orderrecord orders on orders.id=intent.order_id join payment.intenttender plan on plan.intent_id=intent.id and plan.kind='wechat'
      join payment.attempt attempt on attempt.intent_id=intent.id where intent.id=$1 and attempt.provider='wechat'
      order by attempt.requested_at desc,attempt.id desc limit 1`, [intentid]);
    const selected = loaded.rows[0];
    if (!selected) return;
    const observed = await this.gateway.query(PaymentReference.payment(selected.order_number).text, paymentApplication(selected));
    await recordProviderObservation(this.pool, selected, observed, 'query');
    assertProviderAmount(selected, observed);
    const action = this.lifecycle.afterQuery(observed.state, intentExpired(selected));
    if (action === 'settle') return this.settleObserved(selected, observed);
    if (action === 'requery') {
      await enqueue(this.pool, 'paymentquery', 'payment', selected.scope_id, { intent: selected.intent }, 30);
      return;
    }
    if (action === 'close') return this.closeExpired(selected);
    if (action === 'recover') return this.resolveProviderRefund(selected, observed);
    if (action === 'expire') return this.expire(selected, observed.state);
    await this.resetAttempt(selected, observed.state);
  }

  private async closeExpired(selected: IntentTarget): Promise<void> {
    let closeFailure: unknown;
    try {
      await this.gateway.close(PaymentReference.payment(selected.order_number).text, paymentApplication(selected));
    } catch (cause) {
      closeFailure = cause;
    }
    const observed = await this.gateway.query(PaymentReference.payment(selected.order_number).text, paymentApplication(selected));
    await recordProviderObservation(this.pool, selected, observed, 'close');
    assertProviderAmount(selected, observed);
    const action = this.lifecycle.afterClose(observed.state);
    if (action === 'settle') return this.settleObserved(selected, observed);
    if (action === 'recover') return this.resolveProviderRefund(selected, observed);
    if (action === 'requery') {
      if (closeFailure) throw closeFailure;
      await enqueue(this.pool, 'paymentquery', 'payment', selected.scope_id, { intent: selected.intent }, 3);
      return;
    }
    await this.expire(selected, observed.state);
  }

  private settleObserved(selected: IntentTarget, observed: ProviderObservation): Promise<void> {
    if (!observed.transaction) throw new Error('PAYMENT_PROVIDER_TRANSACTION_MISSING');
    return this.settleSuccess(selected, observed.transaction);
  }

  private async settleSuccess(selected: IntentTarget, transaction: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const current = (await client.query<{ intent_state: string; payment_state: string; lifecycle_state: string; payment: string | null }>(`select intent.state intent_state,
        orders.payment_state,orders.lifecycle_state,(select id from payment.payment where intent_id=intent.id) payment
        from payment.intent intent join ordering.orderrecord orders on orders.id=intent.order_id join payment.attempt attempt on attempt.intent_id=intent.id
        where intent.id=$1 and attempt.id=$2 for update of intent,orders,attempt`, [selected.intent, selected.attempt])).rows[0];
      if (!current) { await client.query('commit'); return; }
      await client.query(`update payment.attempt set state='succeeded',external_transaction=$2,completed_at=clock_timestamp()
        where id=$1 and (external_transaction is null or external_transaction=$2)`, [selected.attempt, transaction]);
      if (current.payment) { await client.query('commit'); return; }
      const payable = ['created','authorizing','authorized'].includes(current.intent_state)
        && ['unpaid','authorizing'].includes(current.payment_state) && current.lifecycle_state !== 'cancelled';
      if (payable) {
        await this.settlement.capture(client, { intent: selected.intent, order: selected.order_id, scope: selected.scope_id, mall: selected.mall_id,
          member: selected.member_id, amountMinor: selected.amount_minor, currency: selected.currency }, selected.amount_minor === selected.provider_minor ? 'wechat' : 'mixed');
      } else {
        await this.captureLatePayment(client, selected, transaction);
      }
      await client.query('commit');
    } catch (cause) { await client.query('rollback'); throw cause; } finally { client.release(); }
  }

  private async captureLatePayment(database: import('../../foundation/application/ModuleOperations').OperationDatabase, selected: IntentTarget,
    transaction: string): Promise<void> {
    await releaseOrderHolds(database, selected.order_id);
    await database.query(`update payment.intenttender set state=case when kind='wechat' then 'captured' else 'released' end where intent_id=$1`, [selected.intent]);
    await database.query(`update payment.intent set state='captured',version=version+1 where id=$1`, [selected.intent]);
    const payment = `payment:${selected.intent}`;
    await database.query(`insert into payment.payment(id,intent_id,amount_minor,currency,captured_minor,refunded_minor,state,version)
      values($1,$2,$3,$4,$3,0,'captured',0)`, [payment, selected.intent, selected.provider_minor, selected.currency]);
    await database.query(`insert into payment.capture(id,scope_id,mall_id,member_id,order_id,source,currency,amount_minor,state,idempotency_key,completed_at,created_at)
      values($1,$2,$3,$4,$5,'latewechat',$6,$7,'succeeded',$8,clock_timestamp(),clock_timestamp())`,
    [`capture:${selected.intent}`, selected.scope_id, selected.mall_id, selected.member_id, selected.order_id, selected.currency, selected.provider_minor, `late:${selected.intent}`]);
    await database.query(`insert into payment.allocation(payment_id,target_type,target_id,amount_minor,currency)
      values($1,'order',$2,$3,$4)`, [payment, selected.order_id, selected.provider_minor, selected.currency]);
    await orderPort.markLatePaid(database, selected.order_id);
    const refund = await this.refunds.create(database, { id: `refund:late:${selected.intent}`, payment, amountMinor: selected.provider_minor,
      idempotency: `late:${selected.intent}`, reason: 'latepayment', scope: selected.scope_id });
    const evidence = { intent: selected.intent, order: selected.order_id, payment, refund: refund.id, transaction,
      providerMinor: selected.provider_minor, detectedAt: new Date().toISOString() };
    await database.query(`insert into payment.recoverycase(id,scope_id,order_id,resource_type,resource_id,severity,state,error_code,evidence,
      occurrence_count,opened_at) values($1,$2,$3,'intent',$4,'critical','open','PAYMENT_LATE_SUCCESS',$5::jsonb,1,clock_timestamp())
      on conflict(resource_type,resource_id) do update set occurrence_count=payment.recoverycase.occurrence_count+1,evidence=excluded.evidence`,
    [`recovery:late:${selected.intent}`, selected.scope_id, selected.order_id, selected.intent, JSON.stringify(evidence)]);
    await database.query(`insert into runtime.job(id,kind,owner,scope_id,payload,state,priority,available_at,created_at,updated_at)
      values($1,'paymentrefund','payment',$2,jsonb_build_object('refund',$3),'queued',1,clock_timestamp(),clock_timestamp(),clock_timestamp())
      on conflict(id) do update set state='queued',available_at=clock_timestamp(),updated_at=clock_timestamp()`,
    [`job:late:${selected.intent}`, selected.scope_id, refund.id]);
    for (const [type, aggregate, payload] of [
      ['payment.late.detected', payment, evidence],
      ['payment.autorefund.requested', refund.id, { ...evidence, refund: refund.id }],
    ] as const) await database.query(`insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,
      occurred_at,available_at) values($1,$2,1,'payment',$3,$4,$5::jsonb,$1,clock_timestamp(),clock_timestamp())`,
    [`event:${randomUUID()}`, type, aggregate, selected.scope_id, JSON.stringify(payload)]);
  }

  private async expire(selected: IntentTarget, providerState: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const changed = await client.query(`update payment.intent set state=case when expires_at<=clock_timestamp() then 'expired' else 'cancelled' end,version=version+1 where id=$1
        and state in('created','authorizing','authorized') returning id`, [selected.intent]);
      if (changed.rows[0]) {
        await orderPort.cancelUnpaid(client, selected.order_id);
        await releaseOrderHolds(client, selected.order_id);
        await client.query(`insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,occurred_at,available_at)
          values($1,'order.cancelled',1,'order',$2,$3,jsonb_build_object('order',$2,'reason',case when $4='closed' then 'providerclosed' else 'paymenttimeout' end,'providerState',$4),$1,clock_timestamp(),clock_timestamp())`,
        [`event:${randomUUID()}`, selected.order_id, selected.scope_id, providerState]);
      }
      await client.query('commit');
    } catch (cause) { await client.query('rollback'); throw cause; } finally { client.release(); }
  }

  private async resetAttempt(selected: IntentTarget, providerState: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      await client.query("update payment.attempt set state='failed',completed_at=clock_timestamp() where id=$1 and state<>'succeeded'", [selected.attempt]);
      await client.query('delete from payment.prepay where intent_id=$1', [selected.intent]);
      await client.query("update payment.intent set state='created',version=version+1 where id=$1 and state in('authorizing','authorized')", [selected.intent]);
      await orderPort.resetPayment(client, selected.order_id);
      await client.query(`insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,occurred_at,available_at)
        values($1,'payment.attempt.failed',1,'payment',$2,$3,jsonb_build_object('intent',$2,'order',$4,'providerState',$5),$1,clock_timestamp(),clock_timestamp())`,
      [`event:${randomUUID()}`, selected.intent, selected.scope_id, selected.order_id, providerState]);
      await client.query('commit');
    } catch (cause) { await client.query('rollback'); throw cause; } finally { client.release(); }
  }

  private async resolveProviderRefund(selected: IntentTarget, observed: ProviderObservation): Promise<void> {
    const evidence = { intent: selected.intent, order: selected.order_id, providerState: observed.state, amountMinor: observed.amountMinor,
      transaction: observed.transaction ?? null, detectedAt: new Date().toISOString() };
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      await client.query(`insert into payment.recoverycase(id,scope_id,order_id,resource_type,resource_id,severity,state,error_code,evidence,
        occurrence_count,opened_at) values($1,$2,$3,'intent',$4,'high','open','PAYMENT_PROVIDER_REFUNDED',$5::jsonb,1,clock_timestamp())
        on conflict(resource_type,resource_id) do update set occurrence_count=payment.recoverycase.occurrence_count+1,evidence=excluded.evidence`,
      [`recovery:providerrefund:${selected.intent}`, selected.scope_id, selected.order_id, selected.intent, JSON.stringify(evidence)]);
      await client.query(`insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,occurred_at,available_at)
        values($1,'payment.recovery.opened',1,'payment',$2,$3,$4::jsonb,$1,clock_timestamp(),clock_timestamp())`,
      [`event:${randomUUID()}`, selected.intent, selected.scope_id, JSON.stringify(evidence)]);
      await client.query('commit');
    } catch (cause) { await client.query('rollback'); throw cause; } finally { client.release(); }
  }

  private async createRefund(aftersale: string): Promise<string> {
    const id = `refund:${aftersale}`;
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const target = (await client.query<{ payment: string; amount_minor: number; reason: string; scope_id: string }>(`select payment.id payment,
        coalesce(aftersale.amount_minor,payment.captured_minor-payment.refunded_minor)::float8 amount_minor,aftersale.reason,orders.scope_id
        from ordering.aftersale aftersale join ordering.orderrecord orders on orders.id=aftersale.order_id
        join payment.intent intent on intent.order_id=aftersale.order_id join payment.payment payment on payment.intent_id=intent.id
        where aftersale.id=$1 and aftersale.state in('approved','processing')
          and coalesce(aftersale.amount_minor,payment.captured_minor-payment.refunded_minor)>0 for update of aftersale`, [aftersale])).rows[0];
      if (!target) throw new Error('AFTERSALE_REFUND_NOT_RUNNABLE');
      const refund = await this.refunds.create(client, { id, payment: target.payment, amountMinor: target.amount_minor, idempotency: aftersale,
        reason: target.reason, scope: target.scope_id, aftersale });
      await orderPort.startAftersaleRefund(client, aftersale);
      await client.query('commit');
      return refund.id;
    } catch (cause) { await client.query('rollback'); throw cause; } finally { client.release(); }
  }

  private async refund(refundid: string, worker: string): Promise<void> {
    const loaded = await this.pool.query<{ id: string; payment_id: string; state: string; amount_minor: number; currency: string; reason: string;
      external_minor: number; external_total: number; transaction: string | null; order_id: string; scope_id: string; member_id: string }>(`select refund.id,refund.payment_id,refund.state,
      refund.amount_minor::float8 amount_minor,refund.currency,refund.reason,
      coalesce((select sum(leg.amount_minor) from payment.refundtender leg where leg.refund_id=refund.id and leg.kind='wechat'),0)::float8 external_minor,
      coalesce((select plan.amount_minor from payment.intenttender plan where plan.intent_id=intent.id and plan.kind='wechat'),0)::float8 external_total,
      (select attempt.external_transaction from payment.attempt attempt where attempt.intent_id=intent.id and attempt.provider='wechat'
        and attempt.state='succeeded' order by attempt.requested_at desc limit 1) transaction,intent.order_id,orders.scope_id,orders.member_id
      from payment.refund refund join payment.payment payment on payment.id=refund.payment_id join payment.intent intent on intent.id=payment.intent_id
      join ordering.orderrecord orders on orders.id=intent.order_id
      where refund.id=$1 and refund.state in('requested','submitted','processing')`, [refundid]);
    const selected = loaded.rows[0];
    if (!selected) return;
    if (selected.currency !== 'CNY') throw new Error('PAYMENT_CURRENCY_UNSUPPORTED');
    if (selected.external_minor === 0) return this.completeRefund(refundid, null);
    if (!selected.transaction || selected.external_total <= 0) throw new Error('PAYMENT_TRANSACTION_REFERENCE_MISSING');
    const sequence = await this.pool.query<{ sequence: number }>(`select coalesce(max(sequence),0)+1 sequence from payment.providerattempt where refund_id=$1`, [refundid]);
    const attempt = `providerattempt:${randomUUID()}`;
    await this.pool.query(`insert into payment.providerattempt(id,refund_id,sequence,operation,worker_id,outcome,started_at)
      values($1,$2,$3,$4,$5,'started',clock_timestamp())`, [attempt, refundid, sequence.rows[0]!.sequence, selected.state === 'requested' ? 'apply' : 'query', worker]);
    await channelOperationPort.record(this.pool, { id: `provideroperation:refund:${refundid}`, provider: 'wechat', scope: selected.scope_id,
      kind: 'refund', idempotency: refundid, reference: refundid, external: null, state: 'processing',
      requestHash: digest(`${refundid}:${selected.external_minor}:${selected.external_total}:${selected.currency}`), response: {} });
    let result: Readonly<{ state: 'processing' | 'succeeded' | 'failed'; reference: string }>;
    try {
      result = selected.state === 'requested'
        ? await this.gateway.refund({ refundNumber: PaymentReference.refund(refundid).text, transaction: selected.transaction,
          refundMinor: selected.external_minor, totalMinor: selected.external_total, reason: selected.reason })
        : await this.gateway.queryRefund(PaymentReference.refund(refundid).text);
      await this.pool.query(`update payment.providerattempt set outcome=$2,provider_state=$3,provider_reference=$4,completed_at=clock_timestamp() where id=$1`,
      [attempt, 'succeeded', result.state, result.reference]);
      await channelOperationPort.update(this.pool, { provider: 'wechat', kind: 'refund', idempotency: refundid, external: result.reference,
        state: result.state === 'failed' ? 'failed' : result.state === 'succeeded' ? 'succeeded' : 'processing', response: result });
    } catch (cause) {
      await this.pool.query(`update payment.providerattempt set outcome='unknown',error_code=$2,completed_at=clock_timestamp() where id=$1`, [attempt, error(cause)]);
      await channelOperationPort.update(this.pool, { provider: 'wechat', kind: 'refund', idempotency: refundid,
        state: 'unknown', response: { error: error(cause) } });
      throw cause;
    }
    if (result.state === 'failed') {
      const client = await this.pool.connect();
      try {
        await client.query('begin');
        await client.query("update payment.refund set state='failed',external_transaction=$2,version=version+1 where id=$1 and state<>'succeeded'", [refundid, result.reference]);
        await client.query("update payment.refundtender set state='failed',provider_reference=case when kind='wechat' then $2 else null end where refund_id=$1 and state<>'succeeded'", [refundid, result.reference]);
        await client.query('commit');
      } catch (cause) { await client.query('rollback'); throw cause; } finally { client.release(); }
      return;
    }
    await this.pool.query(`with changed as(update payment.refund set state='processing',external_transaction=$2,version=version+1
      where id=$1 and state<>'succeeded' returning id) update payment.refundtender set state='processing',provider_reference=case when kind='wechat' then $2 else provider_reference end
      where refund_id=$1 and state='planned'`, [refundid, result.reference]);
    if (result.state === 'processing') {
      await enqueue(this.pool, 'paymentrefund', 'payment', selected.scope_id, { refund: refundid }, 30);
      return;
    }
    await this.completeRefund(refundid, result.reference);
  }

  private async completeRefund(refundid: string, reference: string | null): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      await this.refundSettlement.complete(client, refundid, reference);
      await client.query('commit');
    } catch (cause) { await client.query('rollback'); throw cause; } finally { client.release(); }
  }

  private async completeEvent(eventid: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const event = await client.query<{ payload: Record<string, unknown> }>(`select payload from runtime.inbox
        where consumer='provider.wechatpayment' and event_id=$1 and processed_at is null for update`, [eventid]);
      const payload = event.rows[0]?.payload;
      if (!payload) { await client.query('commit'); return; }
      if (typeof payload.tradeState === 'string') await client.query(`insert into payment.observation(id,attempt_id,provider_event_id,state,amount_minor,currency,payload_hash,observed_at)
        select $1,attempt.id,$2,$3,$4,'CNY',$5,clock_timestamp() from payment.intent intent join payment.attempt attempt on attempt.intent_id=intent.id
        where intent.provider_reference=$6 order by attempt.requested_at desc limit 1 on conflict(provider_event_id) do nothing`,
      [`observation:${digest(eventid)}`, eventid, payload.tradeState, payload.totalCents, digest(JSON.stringify(payload)), payload.outTradeNo]);
      await client.query(`update runtime.inbox set processed_at=clock_timestamp(),attempts=attempts+1
        where consumer='provider.wechatpayment' and event_id=$1`, [eventid]);
      await client.query('commit');
    } catch (cause) { await client.query('rollback'); throw cause; } finally { client.release(); }
  }
}
