import { PaymentReference } from './domain/model/PaymentReference';
import { randomUUID } from 'node:crypto';
import type { OperationDatabase } from '../../foundation/application/ModuleOperations';

export interface PaymentTenderPlan {
  readonly kind: string;
  readonly reference: string | null;
  readonly amountMinor: number;
}

export class PaymentPort {
  reference(orderNumber: string): string { return PaymentReference.payment(orderNumber).text; }

  async plan(database: OperationDatabase, input: Readonly<{ order: string; orderNumber: string; member: string; currency: string;
    amountMinor: number; idempotency: string; tenders: readonly PaymentTenderPlan[] }>): Promise<string> {
    const intent = `intent:${randomUUID()}`;
    await database.query(`insert into payment.intent(id,order_id,member_id,currency,amount_minor,state,idempotency_key,provider_reference,expires_at,version)
      values($1,$2,$3,$4,$5,'created',$6,$7,clock_timestamp()+interval '30 minutes',0)`,
    [intent, input.order, input.member, input.currency, input.amountMinor, input.idempotency, this.reference(input.orderNumber)]);
    for (let sequence = 0; sequence < input.tenders.length; sequence += 1) {
      const tender = input.tenders[sequence]!;
      await database.query(`insert into payment.intenttender(intent_id,sequence,kind,reference_id,amount_minor,state)
        values($1,$2,$3,$4,$5,$6)`, [intent, sequence + 1, tender.kind, tender.reference, tender.amountMinor,
        tender.kind === 'wechat' ? 'planned' : 'held']);
    }
    return intent;
  }

  async expire(database: OperationDatabase, order: string | null): Promise<void> {
    await database.query(`update payment.intent set state='expired',version=version+1 where expires_at<=clock_timestamp()
      and state in('created','authorizing','authorized') and ($1::text is null or order_id=$1)
      and not exists(select 1 from payment.attempt attempt where attempt.intent_id=payment.intent.id and attempt.provider='wechat')`, [order]);
  }
}

export const paymentPort = new PaymentPort();
