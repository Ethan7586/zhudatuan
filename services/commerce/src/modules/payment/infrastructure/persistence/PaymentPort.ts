import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import { PaymentReference } from '../../domain/model/PaymentReference';
import { randomUUID } from 'node:crypto';
import type { PaymentIntentReceipt, PaymentTenderPlan } from '../../public';
import { PaymentIntent } from '../../domain/model/PaymentIntent';
import { Allocation } from '../../domain/model/Allocation';
import { DomainError } from '../../../../platform/error/DomainError';
export class PaymentPort {
  private readonly transactions = new PgTransactionAccess();
  async externalAmount(context: ReadTransactionContext, kind: 'payment' | 'refund', reference: string): Promise<number> {
    const database = this.transactions.database(context);
    const result =
      kind === 'refund'
        ? await database.query<{
            amount: number;
          }>(
            `select coalesce(sum(amount_minor),0)::float8 amount from payment.refundtender
            where refund_id=$1 and kind='wechat' and state='succeeded'`,
            [reference]
          )
        : await database.query<{
            amount: number;
          }>(
            `select coalesce(sum(tender.amount_minor),0)::float8 amount from payment.payment payment
            join payment.intenttender tender on tender.intent_id=payment.intent_id where payment.id=$1
            and tender.kind='wechat' and tender.state='captured'`,
            [reference]
          );
    return result.rows[0]?.amount ?? 0;
  }
  async reconciliation(context: ReadTransactionContext, references: readonly string[]) {
    const database = this.transactions.database(context);
    if (references.length === 0) return Object.freeze([]);
    const result = await database.query<{
      reference: string;
      kind: 'payment' | 'refund';
      id: string;
      amountMinor: number;
    }>(
      `select attempt.external_transaction reference,'payment'::text kind,payment.id,payment.amount_minor::float8 "amountMinor"
      from payment.attempt attempt join payment.payment payment on payment.intent_id=attempt.intent_id
      where attempt.external_transaction=any($1::text[])
      union all select coalesce(refund.external_transaction,refund.provider_reference) reference,'refund',refund.id,
      refund.amount_minor::float8 from payment.refund refund where refund.external_transaction=any($1::text[])
      or refund.provider_reference=any($1::text[]) order by reference,kind,id`,
      [references]
    );
    return Object.freeze(result.rows.map((row) => Object.freeze(row)));
  }
  async orders(context: ReadTransactionContext, payments: readonly string[]) {
    if (payments.length === 0) return Object.freeze([]);
    const result = await this.transactions.database(context).query<{ payment: string; order: string }>(
      `select payment.id payment,intent.order_id "order" from payment.payment payment
      join payment.intent intent on intent.id=payment.intent_id where payment.id=any($1::text[]) order by payment.id`,
      [payments]
    );
    return Object.freeze(result.rows.map((row) => Object.freeze(row)));
  }
  async verifyImportEvidence(context: ReadTransactionContext, reference: string, scope: string, amountMinor: number, currency: string): Promise<boolean> {
    const database = this.transactions.database(context);
    const result = await database.query(
      `select 1 from payment.attempt attempt join payment.payment payment on payment.intent_id=attempt.intent_id
      join payment.intent intent on intent.id=payment.intent_id
      where attempt.external_transaction=$1 and intent.scope_id=$2 and payment.amount_minor=$3 and payment.currency=$4
      and payment.state in('captured','partially_refunded','refunded') limit 1`,
      [reference, scope, amountMinor, currency]
    );
    return Boolean(result.rows[0]);
  }
  reference(orderNumber: string): string {
    return PaymentReference.payment(orderNumber).text;
  }
  async prepare(
    context: WriteTransactionContext,
    input: Readonly<{
      order: string;
      orderNumber: string;
      scope: string;
      mall: string;
      member: string;
      currency: string;
      amountMinor: number;
      idempotency: string;
      tenders: readonly PaymentTenderPlan[];
    }>
  ): Promise<PaymentIntentReceipt> {
    const database = this.transactions.database(context);
    await database.query('select pg_advisory_xact_lock(hashtextextended($1,0))', [`payment:intent:${input.order}`]);
    const plan = new Allocation(
      input.tenders.map((tender, sequence) => Object.freeze({ sequence: sequence + 1, ...tender })),
      input.amountMinor
    );
    const current = await database.query<{ id: string; scope_id: string; member_id: string; currency: string; amount_minor: number; expires_at: string; external: boolean }>(
      `select intent.id,intent.scope_id,intent.member_id,intent.currency,intent.amount_minor::float8 amount_minor,intent.expires_at,
      exists(select 1 from payment.intenttender tender where tender.intent_id=intent.id and tender.kind='wechat' and tender.amount_minor>0) external
      from payment.intent intent where intent.order_id=$1 and intent.state in('created','preparing','pending')
      order by intent.expires_at desc,intent.id desc limit 1 for update`,
      [input.order]
    );
    const existing = current.rows[0];
    if (existing) {
      if (existing.scope_id !== input.scope || existing.member_id !== input.member || existing.currency !== input.currency || existing.amount_minor !== input.amountMinor) throw new DomainError('PAYMENT_INTENT_CONFLICT');
      return Object.freeze({ intent: existing.id, external: existing.external, expiresAt: new Date(existing.expires_at).toISOString() });
    }
    const retryable = await database.query<{
      id: string;
      scope_id: string;
      mall_id: string;
      member_id: string;
      currency: string;
      amount_minor: number;
      idempotency_key: string;
      provider_reference: string;
      expires_at: string;
      version: number;
      external: boolean;
      internal: boolean;
    }>(
      `select intent.id,intent.scope_id,intent.mall_id,intent.member_id,intent.currency,intent.amount_minor::float8 amount_minor,
      intent.idempotency_key,intent.provider_reference,intent.expires_at,intent.version,
      exists(select 1 from payment.intenttender tender where tender.intent_id=intent.id and tender.kind='wechat' and tender.amount_minor>0) external,
      exists(select 1 from payment.intenttender tender where tender.intent_id=intent.id and tender.kind<>'wechat' and tender.amount_minor>0) internal
      from payment.intent intent where intent.order_id=$1 and intent.purpose='purchase' and intent.state='failed'
      order by intent.updated_at desc,intent.id desc limit 1 for update`,
      [input.order]
    );
    const failed = retryable.rows[0];
    if (failed) {
      if (failed.scope_id !== input.scope || failed.mall_id !== input.mall || failed.member_id !== input.member || failed.currency !== input.currency || failed.amount_minor !== input.amountMinor)
        throw new DomainError('PAYMENT_INTENT_CONFLICT');
      if (context.operation !== 'payment.intents.create' || failed.internal) throw new DomainError('PAYMENT_INTENT_NOT_PAYABLE');
      const now = new Date();
      const retried = PaymentIntent.restore({
        id: failed.id,
        order: input.order,
        scope: failed.scope_id,
        mall: failed.mall_id,
        member: failed.member_id,
        currency: failed.currency,
        amountMinor: failed.amount_minor,
        state: 'failed',
        idempotency: failed.idempotency_key,
        providerReference: failed.provider_reference,
        expiresAt: new Date(failed.expires_at),
        version: failed.version,
      })
        .retry(input.idempotency, new Date(now.getTime() + 30 * 60 * 1000), now)
        .snapshot();
      const updated = await database.query<{ expires_at: string }>(`update payment.intent set state=$2,idempotency_key=$3,expires_at=$4,version=$5 where id=$1 and version=$6 and state='failed' returning expires_at`, [
        retried.id,
        retried.state,
        retried.idempotency,
        retried.expiresAt,
        retried.version,
        failed.version,
      ]);
      const expiresAt = updated.rows[0]?.expires_at;
      if (!expiresAt) throw new DomainError('PAYMENT_INTENT_CONFLICT');
      return Object.freeze({ intent: failed.id, external: failed.external, expiresAt: new Date(expiresAt).toISOString() });
    }
    const intent = `intent:${randomUUID()}`;
    const external = plan.lines.some(({ kind, amountMinor }) => kind === 'wechat' && amountMinor > 0);
    const now = new Date();
    const created = PaymentIntent.create({
      id: intent,
      order: input.order,
      scope: input.scope,
      mall: input.mall,
      member: input.member,
      currency: input.currency,
      amountMinor: input.amountMinor,
      idempotency: input.idempotency,
      providerReference: this.reference(input.orderNumber),
      expiresAt: new Date(now.getTime() + 30 * 60 * 1000),
    });
    const aggregate = (external ? created.transition('preparing', now) : created).snapshot();
    const inserted = await database.query<{
      expires_at: string;
    }>(
      `insert into payment.intent(id,order_id,scope_id,mall_id,order_number,member_id,currency,amount_minor,state,idempotency_key,provider_reference,
      purpose,expires_at,created_at,updated_at,version)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'purchase',$12,clock_timestamp(),clock_timestamp(),0)
      returning expires_at`,
      [aggregate.id, aggregate.order, aggregate.scope, aggregate.mall, input.orderNumber, aggregate.member, aggregate.currency, aggregate.amountMinor, aggregate.state, aggregate.idempotency, aggregate.providerReference, aggregate.expiresAt]
    );
    if (plan.lines.length > 0)
      await database.query(
        `insert into payment.intenttender(intent_id,sequence,kind,reference_id,amount_minor,state)
      select $1,source.sequence,source.kind,source.reference,source.amount,
      case when source.kind='wechat' then 'planned' else 'held' end
      from unnest($2::integer[],$3::text[],$4::text[],$5::bigint[]) source(sequence,kind,reference,amount)`,
        [intent, plan.lines.map(({ sequence }) => sequence), plan.lines.map(({ kind }) => kind), plan.lines.map(({ reference }) => reference), plan.lines.map(({ amountMinor }) => amountMinor)]
      );
    const expiresAt = inserted.rows[0]?.expires_at;
    if (!expiresAt) {
      const selected = await database.query<{
        expires_at: string;
      }>('select expires_at from payment.intent where id=$1', [intent]);
      const value = selected.rows[0]?.expires_at;
      if (!value) throw new Error('PAYMENT_INTENT_NOT_FOUND');
      return Object.freeze({ intent, external, expiresAt: new Date(value).toISOString() });
    }
    return Object.freeze({ intent, external, expiresAt: new Date(expiresAt).toISOString() });
  }
  async expire(context: WriteTransactionContext, order: string | null): Promise<void> {
    const database = this.transactions.database(context);
    await database.query(
      `update payment.intent set state='expired',version=version+1 where expires_at<=clock_timestamp()
      and state in('created','preparing','pending') and ($1::text is null or order_id=$1)
      and not exists(select 1 from payment.attempt attempt where attempt.intent_id=payment.intent.id and attempt.provider='wechat')`,
      [order]
    );
  }
  async expirations(context: ReadTransactionContext, order: string | null) {
    const database = this.transactions.database(context);
    const result = await database.query<{
      intent: string;
      order: string;
      external: boolean;
    }>(
      `select intent.id intent,intent.order_id "order",exists(select 1 from payment.attempt attempt
      where attempt.intent_id=intent.id and attempt.provider='wechat') external
      from payment.intent intent where intent.expires_at<=clock_timestamp()
      and intent.state in('created','preparing','pending') and ($1::text is null or intent.order_id=$1)
      order by intent.id`,
      [order]
    );
    return Object.freeze(result.rows.map((row) => Object.freeze(row)));
  }
}
