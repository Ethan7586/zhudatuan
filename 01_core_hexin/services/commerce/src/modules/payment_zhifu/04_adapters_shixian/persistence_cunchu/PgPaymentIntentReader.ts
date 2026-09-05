import type { DatabasePool } from '../../../../foundation/persistence/Pool';
import type {
  PaymentIntentReadInput,
  PaymentIntentReader,
  PaymentIntentSnapshot,
} from '../../03_application_yingyong/queries_duqu/ReadPaymentIntent';

interface PaymentIntentRow {
  readonly intent_id: string;
  readonly order_id: string;
  readonly intent_state: string;
  readonly expires_at: string;
  readonly amount_minor: number;
  readonly currency: string;
  readonly payment_id: string | null;
  readonly payment_state: string | null;
  readonly attempt_state: string | null;
  readonly action: unknown | null;
}

export class PgPaymentIntentReader implements PaymentIntentReader {
  constructor(private readonly database: Pick<DatabasePool, 'query'>) {}

  async read(input: PaymentIntentReadInput): Promise<PaymentIntentSnapshot | undefined> {
    const result = await this.database.query<PaymentIntentRow>(
      `select intent.id intent_id,intent.order_id,intent.state intent_state,intent.expires_at,
      intent.amount_minor::float8 amount_minor,intent.currency,payment.id payment_id,payment.state payment_state,
      attempt.state attempt_state,prepay.parameters action
      from payment.intent intent
      join access.membership membership on membership.member_id=intent.member_id and membership.id=$2
      left join payment.payment payment on payment.mall_id=intent.mall_id and payment.intent_id=intent.id
      left join lateral(select candidate.state from payment.attempt candidate
        where candidate.mall_id=intent.mall_id and candidate.intent_id=intent.id
        order by candidate.requested_at desc,candidate.id desc limit 1) attempt on true
      left join payment.prepay prepay on prepay.mall_id=intent.mall_id and prepay.intent_id=intent.id
      where intent.mall_id=$3 and (intent.id=$1 or payment.id=$1)
      limit 1`,
      [input.payment, input.membership, input.mall],
    );
    const selected = result.rows[0];
    if (!selected) return undefined;
    return Object.freeze({
      intentId: selected.intent_id,
      orderId: selected.order_id,
      intentState: selected.intent_state,
      expiresAt: selected.expires_at,
      amountMinor: selected.amount_minor,
      currency: selected.currency,
      paymentId: selected.payment_id,
      paymentState: selected.payment_state,
      attemptState: selected.attempt_state,
      action: selected.action,
    });
  }
}
