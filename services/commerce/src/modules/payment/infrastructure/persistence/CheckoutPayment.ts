import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import type { WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { OperationRequest } from '../../../../pipeline/OperationHandler';
import type { CheckoutPaymentPort, CheckoutPaymentResult, PreparedPayment } from '../../public';
import type { PaymentContinuation } from '../../application/port/PaymentContinuation';
import { PaymentPort } from './PaymentPort';
import type { PaymentScene, PaymentTenderPlan } from '../../public';
import { PaymentSettlement } from './PaymentSettlement';
interface PrepareInput {
  readonly order: string;
  readonly orderNumber: string;
  readonly scope: string;
  readonly mall: string;
  readonly member: string;
  readonly currency: string;
  readonly amountMinor: number;
  readonly idempotency: string;
  readonly tenders: readonly PaymentTenderPlan[];
}
/** Checkout-facing payment orchestration. Provider I/O is intentionally isolated in continue(). */
export class CheckoutPayment implements CheckoutPaymentPort {
  private readonly transactions = new PgTransactionAccess();
  constructor(
    private readonly payments: PaymentPort,
    private readonly settlement: PaymentSettlement,
    private readonly intents: PaymentContinuation
  ) {}
  prepare(context: WriteTransactionContext, input: Readonly<PrepareInput>): Promise<PreparedPayment> {
    return this.payments.prepare(context, input);
  }
  async capture(
    context: WriteTransactionContext,
    input: Readonly<{
      payment: PreparedPayment;
      order: string;
      scope: string;
      mall: string;
      member: string;
      currency: string;
      amountMinor: number;
      snapshot: unknown;
    }>
  ): Promise<CheckoutPaymentResult> {
    if (input.payment.external) return Object.freeze({ paymentId: input.payment.intent, state: 'preparing', expiresAt: input.payment.expiresAt });
    const payment = await this.settlement.capture(
      context,
      { intent: input.payment.intent, order: input.order, scope: input.scope, mall: input.mall, member: input.member, currency: input.currency, amountMinor: input.amountMinor, snapshot: input.snapshot },
      'internal'
    );
    return Object.freeze({ paymentId: payment, state: 'captured' });
  }
  async continue(
    request: OperationRequest,
    input: Readonly<{
      payment: PreparedPayment;
      order: string;
      scene: PaymentScene;
    }>
  ): Promise<CheckoutPaymentResult> {
    if (!input.payment.external) throw new Error('PAYMENT_CONTINUATION_NOT_REQUIRED');
    const result = await this.intents.continue(request, { order: input.order, scene: input.scene });
    const body = record(result.body);
    const state = typeof body.state === 'string' ? body.state : null;
    if (state === 'captured' && typeof body.payment === 'string') return Object.freeze({ paymentId: body.payment, state: 'captured' });
    if (body.parameters && typeof body.parameters === 'object' && !Array.isArray(body.parameters)) {
      return Object.freeze({ paymentId: input.payment.intent, state: 'pending', action: stringRecord(body.parameters), expiresAt: input.payment.expiresAt });
    }
    if (state === 'failed') return Object.freeze({ paymentId: input.payment.intent, state: 'recovery', retryAfter: 5 });
    return Object.freeze({ paymentId: input.payment.intent, state: 'recovery', retryAfter: 5 });
  }
}
function record(value: unknown): Readonly<Record<string, unknown>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('PAYMENT_RESULT_INVALID');
  return value as Readonly<Record<string, unknown>>;
}
function stringRecord(value: object): Readonly<Record<string, string>> {
  const entries = Object.entries(value);
  if (entries.some(([, item]) => typeof item !== 'string')) throw new Error('PAYMENT_ACTION_INVALID');
  return Object.freeze(Object.fromEntries(entries) as Record<string, string>);
}
