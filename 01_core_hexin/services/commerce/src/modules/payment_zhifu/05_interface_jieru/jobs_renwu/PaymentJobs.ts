import { randomUUID } from 'node:crypto';
import type { ClaimedJob, JobProcessor } from '../../../../foundation/application/JobRunner';
import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import type { DatabasePool } from '../../../../foundation/persistence/Pool';
import { providerOccurredAt, type PaymentGateway, type ProviderRefundObservation } from '../../01_public_gongkai/ports_jiekou/PaymentGateway';
import { PaymentReference } from '../../02_domain_yewu/models_moxing/PaymentReference';
import { PaymentSettlement, releaseOrderHolds } from '../../03_application_yingyong/services_fuwu/PaymentSettlement';
import { RefundPlanner } from '../../03_application_yingyong/services_fuwu/RefundPlanner';
import { RefundSettlement } from '../../03_application_yingyong/services_fuwu/RefundSettlement';
import { PaymentLifecycle } from '../../02_domain_yewu/policies_guize/PaymentLifecycle';
import { assertProviderAmount, enqueuePaymentJob as enqueue, intentExpired, jobPayload as object, jobText as text, paymentDigest as digest,
  paymentApplication, providerError as error, recordProviderObservation, type IntentTarget, type ProviderObservation } from '../../03_application_yingyong/services_fuwu/PaymentJobSupport';
import { orderPort } from '../../../order_dingdan';
import { channelOperationPort } from '../../../channel/ChannelModule';

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
    const mall = text(job.scope_id, 'PAYMENT_JOB_MALL_REQUIRED');
    if (this.kind === 'paymentquery') {
      await this.query(mall, text(payload.intent, 'PAYMENT_INTENT_REQUIRED'));
      if (payload.providerEvent) await this.completeEvent(mall, text(payload.providerEvent, 'PAYMENT_PROVIDER_EVENT_INVALID'));
      return;
    }
    const refund = payload.refund ? text(payload.refund, 'PAYMENT_REFUND_REQUIRED')
      : await this.createRefund(mall, text(payload.aftersale, 'AFTERSALE_REQUIRED'));
    await this.refund(mall, refund, job.id);
    if (payload.providerEvent) await this.completeEvent(mall, text(payload.providerEvent, 'PAYMENT_PROVIDER_EVENT_INVALID'));
  }

  private async query(mall: string, intentid: string): Promise<void> {
    const loaded = await this.pool.query<IntentTarget>(`select intent.id intent,intent.order_id,intent.provider_reference,
      intent.mall_id scope_id,intent.mall_id,intent.member_id,intent.amount_minor::float8 amount_minor,
      plan.amount_minor::float8 provider_minor,intent.currency,intent.state intent_state,attempt.id attempt,intent.expires_at,
      attempt.scene,attempt.application_hash
      from payment.intent intent join payment.intenttender plan on plan.mall_id=intent.mall_id and plan.intent_id=intent.id and plan.kind='wechat'
      join payment.attempt attempt on attempt.mall_id=intent.mall_id and attempt.intent_id=intent.id
      where intent.mall_id=$1 and intent.id=$2 and attempt.provider='wechat'
      order by attempt.requested_at desc,attempt.id desc limit 1`, [mall, intentid]);
    const selected = loaded.rows[0];
    if (!selected) return;
    const observed = await this.gateway.query(selected.provider_reference, paymentApplication(selected));
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
      await this.gateway.close(selected.provider_reference, paymentApplication(selected));
    } catch (cause) {
      closeFailure = cause;
    }
    const observed = await this.gateway.query(selected.provider_reference, paymentApplication(selected));
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
    const occurredAt = providerOccurredAt(observed.occurredAt, 'PAYMENT_PROVIDER_OCCURRED_AT_REQUIRED');
    return this.settleSuccess(selected, observed.transaction, occurredAt, paymentEffect(selected, observed.transaction, occurredAt));
  }

  private async settleSuccess(selected: IntentTarget, transaction: string, occurredAt: string, effect: ProviderEffect): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const current = (await client.query<{ intent_state: string; payment: string | null }>(`select intent.state intent_state,
        (select id from payment.payment where mall_id=intent.mall_id and intent_id=intent.id) payment
        from payment.intent intent join payment.attempt attempt on attempt.mall_id=intent.mall_id and attempt.intent_id=intent.id
        where intent.mall_id=$1 and intent.id=$2 and attempt.id=$3 for update of intent,attempt`,
      [selected.mall_id, selected.intent, selected.attempt])).rows[0];
      if (!current) { await client.query('commit'); return; }
      const sealed = await client.query(`update payment.attempt set state='succeeded',external_transaction=$2,completed_at=$3::timestamptz,
        provider_occurred_at=$3::timestamptz,provider_effect=$4::jsonb,
        provider_effect_hash=encode(public.digest($4::jsonb::text,'sha256'),'hex')
        where mall_id=$1 and id=$5 and (external_transaction is null or external_transaction=$2)
          and (provider_effect_hash is null or provider_effect_hash=encode(public.digest($4::jsonb::text,'sha256'),'hex')) returning id`,
      [selected.mall_id, transaction, occurredAt, JSON.stringify(effect), selected.attempt]);
      if (!sealed.rows[0]) throw new Error('PAYMENT_PROVIDER_EFFECT_MISMATCH');
      if (current.payment) {
        await sealCapture(client, selected, occurredAt, effect, selected.amount_minor);
        await client.query('commit');
        return;
      }
      const payable = ['created','authorizing','authorized'].includes(current.intent_state);
      if (payable) {
        await this.settlement.capture(client, { intent: selected.intent, order: selected.order_id, scope: selected.scope_id, mall: selected.mall_id,
          member: selected.member_id, amountMinor: selected.amount_minor, currency: selected.currency },
        selected.amount_minor === selected.provider_minor ? 'wechat' : 'mixed', occurredAt);
        await sealCapture(client, selected, occurredAt, effect, selected.amount_minor);
      } else {
        await this.captureLatePayment(client, selected, transaction, occurredAt, effect);
      }
      await client.query('commit');
    } catch (cause) { await client.query('rollback'); throw cause; } finally { client.release(); }
  }

  private async captureLatePayment(database: OperationDatabase, selected: IntentTarget,
    transaction: string, occurredAt: string, effect: ProviderEffect): Promise<void> {
    await releaseOrderHolds(database, selected.mall_id, selected.order_id);
    await database.query(`update payment.intenttender set state=case when kind='wechat' then 'captured' else 'released' end
      where mall_id=$1 and intent_id=$2`, [selected.mall_id, selected.intent]);
    await database.query(`update payment.intent set state='captured',version=version+1 where mall_id=$1 and id=$2`,
    [selected.mall_id, selected.intent]);
    const payment = `payment:${selected.intent}`;
    await database.query(`insert into payment.payment(id,mall_id,intent_id,amount_minor,currency,captured_minor,refunded_minor,state,version)
      values($1,$2,$3,$4,$5,$4,0,'captured',0)`, [payment, selected.mall_id, selected.intent, selected.provider_minor, selected.currency]);
    await database.query(`insert into payment.capture(id,scope_id,mall_id,member_id,order_id,source,currency,amount_minor,state,idempotency_key,
      completed_at,created_at,provider_occurred_at,provider_effect,provider_effect_hash)
      values($1,$2,$3,$4,$5,'latewechat',$6,$7,'succeeded',$8,$9::timestamptz,clock_timestamp(),$9::timestamptz,$10::jsonb,
        encode(public.digest($10::jsonb::text,'sha256'),'hex'))`,
    [`capture:${selected.intent}`, selected.scope_id, selected.mall_id, selected.member_id, selected.order_id, selected.currency,
      selected.provider_minor, `late:${selected.intent}`, occurredAt, JSON.stringify(effect)]);
    await database.query(`insert into payment.allocation(mall_id,payment_id,target_type,target_id,amount_minor,currency)
      values($1,$2,'order',$3,$4,$5)`, [selected.mall_id, payment, selected.order_id, selected.provider_minor, selected.currency]);
    await orderPort.markLatePaid(database, selected.order_id);
    const refund = await this.refunds.create(database, { id: `refund:late:${selected.intent}`, payment, amountMinor: selected.provider_minor,
      idempotency: `late:${selected.intent}`, reason: 'latepayment', mall: selected.mall_id });
    const evidence = { intent: selected.intent, order: selected.order_id, payment, refund: refund.id, transaction,
      providerMinor: selected.provider_minor, providerOccurredAt: occurredAt, detectedAt: new Date().toISOString() };
    await database.query(`insert into payment.recoverycase(id,scope_id,mall_id,order_id,resource_type,resource_id,severity,state,error_code,evidence,
      occurrence_count,opened_at) values($1,$2,$2,$3,'intent',$4,'critical','open','PAYMENT_LATE_SUCCESS',$5::jsonb,1,clock_timestamp())
      on conflict(mall_id,resource_type,resource_id) do update
      set occurrence_count=payment.recoverycase.occurrence_count+1,evidence=excluded.evidence`,
    [`recovery:late:${selected.intent}`, selected.mall_id, selected.order_id, selected.intent, JSON.stringify(evidence)]);
    await database.query(`insert into runtime.job(id,kind,owner,scope_id,payload,state,priority,available_at,created_at,updated_at)
      values($1,'paymentrefund','payment',$2,jsonb_build_object('refund',$3),'queued',1,clock_timestamp(),clock_timestamp(),clock_timestamp())
      on conflict(id) do update set state='queued',available_at=clock_timestamp(),updated_at=clock_timestamp()`,
    [`job:late:${selected.intent}`, selected.mall_id, refund.id]);
    for (const [type, aggregate, payload, eventOccurredAt] of [
      ['payment.late.detected', payment, evidence, occurredAt],
      ['payment.autorefund.requested', refund.id, { ...evidence, refund: refund.id }, null],
    ] as const) await database.query(`insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,
      occurred_at,available_at) values($1,$2,1,'payment',$3,$4,$5::jsonb,$1,coalesce($6::timestamptz,clock_timestamp()),clock_timestamp())`,
    [`event:${randomUUID()}`, type, aggregate, selected.mall_id, JSON.stringify(payload), eventOccurredAt]);
  }

  private async expire(selected: IntentTarget, providerState: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const changed = await client.query(`update payment.intent set state=case when expires_at<=clock_timestamp() then 'expired' else 'cancelled' end,version=version+1 where id=$1
        and mall_id=$2 and state in('created','authorizing','authorized') returning id`, [selected.intent, selected.mall_id]);
      if (changed.rows[0]) {
        await orderPort.cancelUnpaid(client, selected.order_id);
        await releaseOrderHolds(client, selected.mall_id, selected.order_id);
        await client.query(`insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,occurred_at,available_at)
          values($1,'order.cancelled',1,'order',$2,$3,jsonb_build_object('order',$2,'reason',case when $4='closed' then 'providerclosed' else 'paymenttimeout' end,'providerState',$4),$1,clock_timestamp(),clock_timestamp())`,
        [`event:${randomUUID()}`, selected.order_id, selected.mall_id, providerState]);
      }
      await client.query('commit');
    } catch (cause) { await client.query('rollback'); throw cause; } finally { client.release(); }
  }

  private async resetAttempt(selected: IntentTarget, providerState: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      await client.query("update payment.attempt set state='failed',completed_at=clock_timestamp() where mall_id=$1 and id=$2 and state<>'succeeded'",
      [selected.mall_id, selected.attempt]);
      await client.query('delete from payment.prepay where mall_id=$1 and intent_id=$2', [selected.mall_id, selected.intent]);
      await client.query("update payment.intent set state='created',version=version+1 where mall_id=$1 and id=$2 and state in('authorizing','authorized')",
      [selected.mall_id, selected.intent]);
      await orderPort.resetPayment(client, selected.order_id);
      await client.query(`insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,occurred_at,available_at)
        values($1,'payment.attempt.failed',1,'payment',$2,$3,jsonb_build_object('intent',$2,'order',$4,'providerState',$5),$1,clock_timestamp(),clock_timestamp())`,
      [`event:${randomUUID()}`, selected.intent, selected.mall_id, selected.order_id, providerState]);
      await client.query('commit');
    } catch (cause) { await client.query('rollback'); throw cause; } finally { client.release(); }
  }

  private async resolveProviderRefund(selected: IntentTarget, observed: ProviderObservation): Promise<void> {
    const evidence = { intent: selected.intent, order: selected.order_id, providerState: observed.state, amountMinor: observed.amountMinor,
      transaction: observed.transaction ?? null, detectedAt: new Date().toISOString() };
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      await client.query(`insert into payment.recoverycase(id,scope_id,mall_id,order_id,resource_type,resource_id,severity,state,error_code,evidence,
        occurrence_count,opened_at) values($1,$2,$2,$3,'intent',$4,'high','open','PAYMENT_PROVIDER_REFUNDED',$5::jsonb,1,clock_timestamp())
        on conflict(mall_id,resource_type,resource_id) do update
        set occurrence_count=payment.recoverycase.occurrence_count+1,evidence=excluded.evidence`,
      [`recovery:providerrefund:${selected.intent}`, selected.mall_id, selected.order_id, selected.intent, JSON.stringify(evidence)]);
      await client.query(`insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,occurred_at,available_at)
        values($1,'payment.recovery.opened',1,'payment',$2,$3,$4::jsonb,$1,clock_timestamp(),clock_timestamp())`,
      [`event:${randomUUID()}`, selected.intent, selected.mall_id, JSON.stringify(evidence)]);
      await client.query('commit');
    } catch (cause) { await client.query('rollback'); throw cause; } finally { client.release(); }
  }

  private async createRefund(mall: string, aftersale: string): Promise<string> {
    const id = `refund:${aftersale}`;
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const target = (await client.query<{ payment: string; amount_minor: number; reason: string; scope_id: string }>(`select payment.id payment,
        coalesce(aftersale.amount_minor,payment.captured_minor-payment.refunded_minor)::float8 amount_minor,aftersale.reason,intent.mall_id scope_id
        from ordering.aftersale aftersale join payment.intent intent on intent.mall_id=$1 and intent.order_id=aftersale.order_id
        join payment.payment payment on payment.mall_id=intent.mall_id and payment.intent_id=intent.id
        where aftersale.id=$2 and aftersale.state in('approved','processing')
          and coalesce(aftersale.amount_minor,payment.captured_minor-payment.refunded_minor)>0 for update of aftersale`, [mall, aftersale])).rows[0];
      if (!target) throw new Error('AFTERSALE_REFUND_NOT_RUNNABLE');
      const refund = await this.refunds.create(client, { id, payment: target.payment, amountMinor: target.amount_minor, idempotency: aftersale,
        reason: target.reason, mall: target.scope_id, aftersale });
      await orderPort.startAftersaleRefund(client, aftersale);
      await client.query('commit');
      return refund.id;
    } catch (cause) { await client.query('rollback'); throw cause; } finally { client.release(); }
  }

  private async refund(mall: string, refundid: string, worker: string): Promise<void> {
    const loaded = await this.pool.query<{ id: string; payment_id: string; state: string; amount_minor: number; currency: string; reason: string;
      external_minor: number; external_total: number; transaction: string | null; order_id: string; scope_id: string; member_id: string }>(`select refund.id,refund.payment_id,refund.state,
      refund.amount_minor::float8 amount_minor,refund.currency,refund.reason,
      coalesce((select sum(leg.amount_minor) from payment.refundtender leg where leg.mall_id=refund.mall_id
        and leg.refund_id=refund.id and leg.kind='wechat'),0)::float8 external_minor,
      coalesce((select plan.amount_minor from payment.intenttender plan where plan.mall_id=intent.mall_id
        and plan.intent_id=intent.id and plan.kind='wechat'),0)::float8 external_total,
      (select attempt.external_transaction from payment.attempt attempt where attempt.mall_id=intent.mall_id
        and attempt.intent_id=intent.id and attempt.provider='wechat' and attempt.state='succeeded'
        order by attempt.requested_at desc limit 1) transaction,intent.order_id,refund.mall_id scope_id,intent.member_id
      from payment.refund refund join payment.payment payment on payment.mall_id=refund.mall_id and payment.id=refund.payment_id
      join payment.intent intent on intent.mall_id=payment.mall_id and intent.id=payment.intent_id
      where refund.mall_id=$1 and refund.id=$2 and refund.state in('requested','submitted','processing')`, [mall, refundid]);
    const selected = loaded.rows[0];
    if (!selected) return;
    if (selected.currency !== 'CNY') throw new Error('PAYMENT_CURRENCY_UNSUPPORTED');
    if (selected.external_minor === 0) return this.completeRefund(mall, refundid, null);
    if (!selected.transaction || selected.external_total <= 0) throw new Error('PAYMENT_TRANSACTION_REFERENCE_MISSING');
    const sealed = await sealedRefundEffect(this.pool, mall, refundid);
    if (sealed) return this.completeRefund(mall, refundid, sealed.reference);
    const sequence = await this.pool.query<{ sequence: number }>(`select coalesce(max(sequence),0)+1 sequence
      from payment.providerattempt where mall_id=$1 and refund_id=$2`, [mall, refundid]);
    const attempt = `providerattempt:${randomUUID()}`;
    await this.pool.query(`insert into payment.providerattempt(id,mall_id,refund_id,sequence,operation,worker_id,outcome,started_at)
      values($1,$2,$3,$4,$5,$6,'started',clock_timestamp())`,
    [attempt, mall, refundid, sequence.rows[0]!.sequence, selected.state === 'requested' ? 'apply' : 'query', worker]);
    await channelOperationPort.record(this.pool, { id: `provideroperation:refund:${refundid}`, provider: 'wechat', scope: selected.scope_id,
      kind: 'refund', idempotency: refundid, reference: refundid, external: null, state: 'processing',
      requestHash: digest(`${refundid}:${selected.external_minor}:${selected.external_total}:${selected.currency}`), response: {} });
    let result: Readonly<ProviderRefundObservation>;
    try {
      result = selected.state === 'requested'
        ? await this.gateway.refund({ refundNumber: PaymentReference.refund(refundid).text, transaction: selected.transaction,
          refundMinor: selected.external_minor, totalMinor: selected.external_total, reason: selected.reason })
        : await this.gateway.queryRefund(PaymentReference.refund(refundid).text);
      const occurredAt = result.state === 'succeeded'
        ? providerOccurredAt(result.occurredAt, 'PAYMENT_REFUND_PROVIDER_OCCURRED_AT_REQUIRED') : null;
      const authority = await persistRefundObservation(this.pool, { mall, attempt, refund: refundid, reference: result.reference,
        state: result.state, occurredAt, effect: occurredAt === null ? null : refundEffect(refundid, result.reference, selected, occurredAt),
        response: result });
      if (authority && result.state !== 'succeeded') return this.completeRefund(mall, refundid, authority.reference);
    } catch (cause) {
      await this.pool.query(`update payment.providerattempt set outcome='unknown',error_code=$3,completed_at=clock_timestamp()
        where mall_id=$1 and id=$2`, [mall, attempt, error(cause)]);
      if (!(await sealedRefundEffect(this.pool, mall, refundid))) await channelOperationPort.update(this.pool, { provider: 'wechat', kind: 'refund',
        idempotency: refundid, state: 'unknown', response: { error: error(cause) } });
      throw cause;
    }
    if (result.state === 'failed') {
      const client = await this.pool.connect();
      try {
        await client.query('begin');
        await client.query("update payment.refund set state='failed',external_transaction=$3,version=version+1 where mall_id=$1 and id=$2 and state<>'succeeded'",
        [mall, refundid, result.reference]);
        await client.query("update payment.refundtender set state='failed',provider_reference=case when kind='wechat' then $3 else null end where mall_id=$1 and refund_id=$2 and state<>'succeeded'",
        [mall, refundid, result.reference]);
        await client.query('commit');
      } catch (cause) { await client.query('rollback'); throw cause; } finally { client.release(); }
      return;
    }
    await this.pool.query(`with changed as(update payment.refund set state='processing',external_transaction=$3,version=version+1
      where mall_id=$1 and id=$2 and state<>'succeeded' returning id) update payment.refundtender
      set state='processing',provider_reference=case when kind='wechat' then $3 else provider_reference end
      where mall_id=$1 and refund_id=$2 and state='planned'`, [mall, refundid, result.reference]);
    if (result.state === 'processing') {
      await enqueue(this.pool, 'paymentrefund', 'payment', selected.scope_id, { refund: refundid }, 30);
      return;
    }
    await this.completeRefund(mall, refundid, result.reference);
  }

  private async completeRefund(mall: string, refundid: string, reference: string | null): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      await this.refundSettlement.complete(client, mall, refundid, reference);
      await client.query('commit');
    } catch (cause) { await client.query('rollback'); throw cause; } finally { client.release(); }
  }

  private async completeEvent(mall: string, eventid: string): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('begin');
      const event = await client.query<{ payload: Record<string, unknown> }>(`select payload from runtime.inbox
        where consumer='provider.wechatpayment' and event_id=$1 and processed_at is null for update`, [eventid]);
      const payload = event.rows[0]?.payload;
      if (!payload) { await client.query('commit'); return; }
      if (typeof payload.tradeState === 'string') {
        const occurredAt = providerOccurredAt(payload.successTime, 'PAYMENT_PROVIDER_EVENT_OCCURRED_AT_REQUIRED');
        const effect = JSON.stringify({ version: 1, provider: 'wechat', kind: 'payment.signed-notification', occurredAt,
          transaction: payload.transactionId, amountMinor: payload.totalCents, currency: 'CNY', receipt: payload });
        const accepted = await client.query(`insert into payment.observation(id,mall_id,attempt_id,provider_event_id,state,amount_minor,currency,
          payload_hash,observed_at,provider_occurred_at,provider_effect,provider_effect_hash)
          select $1,intent.mall_id,attempt.id,$2,$3,$4,'CNY',$5,clock_timestamp(),$6::timestamptz,$7::jsonb,
            encode(public.digest($7::jsonb::text,'sha256'),'hex')
          from payment.intent intent join payment.attempt attempt on attempt.mall_id=intent.mall_id and attempt.intent_id=intent.id
          join payment.payment payment on payment.mall_id=intent.mall_id and payment.intent_id=intent.id
          join payment.capture capture on capture.mall_id=intent.mall_id and capture.order_id=intent.order_id
          where intent.mall_id=$8 and intent.provider_reference=$9 and attempt.state='succeeded' and attempt.external_transaction=$10
            and attempt.provider_occurred_at=$6::timestamptz and capture.provider_occurred_at=$6::timestamptz
          order by attempt.requested_at desc limit 1 on conflict(mall_id,provider_event_id) do nothing returning id`,
        [`observation:${digest(`${mall}:${eventid}`)}`, eventid, payload.tradeState, payload.totalCents, digest(JSON.stringify(payload)),
          occurredAt, effect, mall, payload.outTradeNo, payload.transactionId]);
        if (!accepted.rows[0]) throw new Error('PAYMENT_PROVIDER_EVENT_EFFECT_MISMATCH');
      } else if (typeof payload.refundStatus === 'string' && payload.refundStatus === 'SUCCESS') {
        const occurredAt = providerOccurredAt(payload.successTime, 'PAYMENT_REFUND_PROVIDER_EVENT_OCCURRED_AT_REQUIRED');
        const accepted = await client.query(`select 1 from payment.refund refund join payment.providerattempt attempt
          on attempt.mall_id=refund.mall_id and attempt.refund_id=refund.id where refund.mall_id=$1 and refund.provider_reference=$2
          and attempt.outcome='succeeded' and attempt.provider_state='succeeded' and attempt.provider_reference=$3
          and attempt.provider_occurred_at=$4::timestamptz limit 1`, [mall, payload.outRefundNo, payload.refundId, occurredAt]);
        if (!accepted.rows[0]) throw new Error('PAYMENT_REFUND_PROVIDER_EVENT_EFFECT_MISMATCH');
      }
      await client.query(`update runtime.inbox set processed_at=clock_timestamp(),attempts=attempts+1
        where consumer='provider.wechatpayment' and event_id=$1`, [eventid]);
      await client.query('commit');
    } catch (cause) { await client.query('rollback'); throw cause; } finally { client.release(); }
  }
}

type ProviderEffect = Readonly<Record<string, unknown>>;

function paymentEffect(selected: IntentTarget, transaction: string, occurredAt: string): ProviderEffect {
  return Object.freeze({ version: 1, provider: 'wechat', kind: 'payment.capture', intent: selected.intent, order: selected.order_id,
    transaction, providerAmountMinor: selected.provider_minor, aggregateAmountMinor: selected.amount_minor,
    currency: selected.currency, occurredAt });
}

function refundEffect(refund: string, reference: string,
  selected: Readonly<{ payment_id: string; external_minor: number; external_total: number; currency: string }>,
  occurredAt: string): ProviderEffect {
  return Object.freeze({ version: 1, provider: 'wechat', kind: 'payment.refund', refund, payment: selected.payment_id, reference,
    amountMinor: selected.external_minor, totalMinor: selected.external_total, currency: selected.currency, occurredAt });
}

async function sealCapture(database: OperationDatabase, selected: IntentTarget, occurredAt: string, effect: ProviderEffect,
  aggregateAmount: number): Promise<void> {
  const serialized = JSON.stringify(effect);
  const result = await database.query(`update payment.capture set completed_at=$2::timestamptz,provider_occurred_at=$2::timestamptz,
      provider_effect=$3::jsonb,provider_effect_hash=encode(public.digest($3::jsonb::text,'sha256'),'hex')
    where id=$1 and mall_id=$4 and scope_id=$5 and order_id=$6 and amount_minor=$7 and currency=$8 and state='succeeded'
      and (provider_effect_hash is null or provider_effect_hash=encode(public.digest($3::jsonb::text,'sha256'),'hex')) returning id`,
  [`capture:${selected.intent}`, occurredAt, serialized, selected.mall_id, selected.scope_id, selected.order_id, aggregateAmount, selected.currency]);
  if (!result.rows[0]) throw new Error('PAYMENT_CAPTURE_PROVIDER_EFFECT_MISMATCH');
}

async function sealedRefundEffect(database: DatabasePool, mall: string, refund: string): Promise<Readonly<{ reference: string }> | null> {
  const result = await database.query<{ reference: string | null }>(`select provider_effect->>'reference' reference from payment.providerattempt
    where mall_id=$1 and refund_id=$2 and outcome='succeeded' and provider_state='succeeded'
      and provider_occurred_at is not null and provider_effect_hash is not null
    order by provider_occurred_at,id limit 1`, [mall, refund]);
  const reference = result.rows[0]?.reference;
  if (reference === undefined) return null;
  if (!reference) throw new Error('PAYMENT_REFUND_PROVIDER_EFFECT_MISMATCH');
  return Object.freeze({ reference });
}

async function persistRefundObservation(pool: DatabasePool, input: Readonly<{ mall: string; attempt: string; refund: string; reference: string;
  state: 'processing' | 'succeeded' | 'failed'; occurredAt: string | null; effect: ProviderEffect | null;
  response: ProviderRefundObservation }>): Promise<Readonly<{ reference: string }> | null> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const locked = await client.query(`select id from payment.refund where mall_id=$1 and id=$2 for update`, [input.mall, input.refund]);
    if (!locked.rows[0]) throw new Error('PAYMENT_REFUND_NOT_FOUND');
    const serialized = input.effect === null ? null : JSON.stringify(input.effect);
    const prior = await client.query<{ reference: string | null; matches: boolean }>(`select provider_effect->>'reference' reference,
        case when $3::jsonb is null then false else provider_effect_hash=encode(public.digest($3::jsonb::text,'sha256'),'hex') end matches
      from payment.providerattempt where mall_id=$1 and refund_id=$2 and outcome='succeeded' and provider_state='succeeded'
        and provider_occurred_at is not null and provider_effect_hash is not null
      order by provider_occurred_at,id limit 1`, [input.mall, input.refund, serialized]);
    const authoritative = prior.rows[0];
    if (authoritative && input.state === 'succeeded' && !authoritative.matches) throw new Error('PAYMENT_REFUND_PROVIDER_EFFECT_MISMATCH');
    const changed = input.state === 'succeeded'
      ? await client.query(`update payment.providerattempt set outcome='succeeded',provider_state='succeeded',provider_reference=$3,
          completed_at=$4::timestamptz,provider_occurred_at=$4::timestamptz,provider_effect=$5::jsonb,
          provider_effect_hash=encode(public.digest($5::jsonb::text,'sha256'),'hex') where mall_id=$1 and id=$2
          and (provider_effect_hash is null or provider_effect_hash=encode(public.digest($5::jsonb::text,'sha256'),'hex')) returning id`,
        [input.mall, input.attempt, input.reference, input.occurredAt, serialized])
      : await client.query(`update payment.providerattempt set outcome='succeeded',provider_state=$3,provider_reference=$4,
          completed_at=clock_timestamp() where mall_id=$1 and id=$2 and provider_effect_hash is null returning id`,
        [input.mall, input.attempt, input.state, input.reference]);
    if (!changed.rows[0]) throw new Error('PAYMENT_REFUND_PROVIDER_EFFECT_MISMATCH');
    if (!authoritative || input.state === 'succeeded') await channelOperationPort.update(client, { provider: 'wechat', kind: 'refund',
      idempotency: input.refund, external: input.reference,
      state: input.state === 'failed' ? 'failed' : input.state === 'succeeded' ? 'succeeded' : 'processing', response: input.response });
    await client.query('commit');
    if (!authoritative) return null;
    if (!authoritative.reference) throw new Error('PAYMENT_REFUND_PROVIDER_EFFECT_MISMATCH');
    return Object.freeze({ reference: authoritative.reference });
  } catch (cause) {
    await client.query('rollback');
    throw cause;
  } finally { client.release(); }
}
