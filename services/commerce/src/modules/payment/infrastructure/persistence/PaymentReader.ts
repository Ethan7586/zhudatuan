import type { SqlExecutor } from '../../../../adapter/database/PgTransactionAccess';

import { DomainError } from '../../../../foundation/domain/DomainError';
import type { MemberAccessPort } from '../../../access/public';
import type { OrderPaymentPort } from '../../../order/public';
interface PaymentRow {
  readonly intent_id: string;
  readonly order_id: string;
  readonly intent_state: string;
  readonly expires_at: string;
  readonly payment_id: string | null;
  readonly attempt_state: string | null;
  readonly action: unknown | null;
}
/** Member-scoped canonical payment projection used by the result and recovery UI. */
export class PaymentReader {
  constructor(
    private readonly members: Pick<MemberAccessPort, 'member'>,
    private readonly orders: Pick<OrderPaymentPort, 'payment'>
  ) {}
  async execute(database: SqlExecutor, membership: string, paymentid: string) {
    const member = await this.members.member(database.transaction, membership);
    const result = await database.query<PaymentRow>(
      `select intent.id intent_id,intent.order_id,intent.state intent_state,intent.expires_at,
      payment.id payment_id,attempt.state attempt_state,action.parameters action
      from payment.intent intent
      left join payment.payment payment on payment.intent_id=intent.id
      left join lateral(select candidate.state from payment.attempt candidate where candidate.intent_id=intent.id
        order by candidate.requested_at desc,candidate.id desc limit 1) attempt on true
      left join lateral(select candidate.parameters from payment.action candidate where candidate.intent_id=intent.id
        and candidate.state='active' and candidate.expires_at>clock_timestamp()
        order by candidate.created_at desc,candidate.id desc limit 1) action on true
      where intent.member_id=$2 and (intent.id=$1 or payment.id=$1)`,
      [paymentid, member]
    );
    const selected = result.rows[0];
    if (!selected || !(await this.orders.payment(database.transaction, selected.order_id, member))) throw new DomainError('RESOURCE_NOT_FOUND');
    const expiresAt = new Date(selected.expires_at).toISOString();
    if (selected.payment_id || selected.intent_state === 'captured') {
      return Object.freeze({ intentId: selected.intent_id, orderId: selected.order_id, paymentId: selected.payment_id ?? selected.intent_id, state: 'captured' as const, action: null, expiresAt });
    }
    if (selected.action && selected.intent_state === 'pending') {
      return Object.freeze({ intentId: selected.intent_id, orderId: selected.order_id, paymentId: selected.intent_id, state: 'pending' as const, action: stringRecord(selected.action), expiresAt });
    }
    const state = selected.attempt_state === 'unknown' ? 'recovery' : selected.intent_state === 'failed' ? 'failed' : selected.intent_state === 'expired' ? 'expired' : 'preparing';
    return Object.freeze({ intentId: selected.intent_id, orderId: selected.order_id, paymentId: selected.intent_id, state, action: null, expiresAt, retryAfter: state === 'failed' || state === 'expired' ? 0 : 5 });
  }
}
function stringRecord(value: unknown): Readonly<Record<string, string>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('PAYMENT_ACTION_INVALID');
  const entries = Object.entries(value);
  if (entries.some(([, item]) => typeof item !== 'string')) throw new Error('PAYMENT_ACTION_INVALID');
  return Object.freeze(Object.fromEntries(entries) as Record<string, string>);
}
