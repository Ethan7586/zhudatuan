import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import { PaymentReference } from '../../domain/model/PaymentReference';
import { randomUUID } from 'node:crypto';
import type { PaymentPlan, PaymentTenderPlan } from '../../public/PaymentPlan';
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
  ): Promise<PaymentPlan> {
    const database = this.transactions.database(context);
    const intent = `intent:${randomUUID()}`;
    const external = input.tenders.some(({ kind, amountMinor }) => kind === 'wechat' && amountMinor > 0);
    const inserted = await database.query<{
      expires_at: string;
    }>(
      `insert into payment.intent(id,order_id,scope_id,mall_id,order_number,member_id,currency,amount_minor,state,idempotency_key,provider_reference,expires_at,version)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,clock_timestamp()+interval '30 minutes',0)
      returning expires_at`,
      [intent, input.order, input.scope, input.mall, input.orderNumber, input.member, input.currency, input.amountMinor, external ? 'preparing' : 'created', input.idempotency, this.reference(input.orderNumber)]
    );
    for (let sequence = 0; sequence < input.tenders.length; sequence += 1) {
      const tender = input.tenders[sequence]!;
      await database.query(
        `insert into payment.intenttender(intent_id,sequence,kind,reference_id,amount_minor,state)
        values($1,$2,$3,$4,$5,$6)`,
        [intent, sequence + 1, tender.kind, tender.reference, tender.amountMinor, tender.kind === 'wechat' ? 'planned' : 'held']
      );
    }
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
