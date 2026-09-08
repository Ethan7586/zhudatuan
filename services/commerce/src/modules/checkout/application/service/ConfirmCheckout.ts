import { randomUUID } from 'node:crypto';
import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import { Money } from '@shop/kernel';
import type { FinalizeContext } from '../../../../pipeline/HandlerContext';
import { requireAccess } from '../../../../pipeline/OperationAccess';
import type { OperationReply, OperationRequest, OperationResult } from '../../../../pipeline/OperationHandler';
import { bodyRecord } from '../../../../pipeline/Validation';
import { DomainError } from '../../../../platform/error/DomainError';
import type { OutboxWriter } from '../../../../platform/messaging/Outbox';
import type { WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import { organizationScope } from '../../../../platform/security/OrganizationScope';
import type { MemberAccessPort } from '../../../access/public';
import type { CartWritePort } from '../../../cart/public';
import type { OrderIntentPort } from '../../../order/public';
import type { OrganizationReadPort } from '../../../organization/public';
import type { CheckoutPaymentPort, CheckoutPaymentResult, PreparedPayment } from '../../../payment/public';
import type { CheckoutPricingPort } from '../../../pricing/public';
import type { OrderCheckoutSessionPort } from '../../public';
import { confirmationDigest } from '../../domain/model/ConfirmationToken';
import { ConfirmQuotePolicy, assertTenderTotal, experienceVersion, object, paymentScene, text } from '../../domain/policy/ConfirmQuotePolicy';
import { LockOrderGuard } from '../../domain/policy/LockOrderGuard';
import type { CheckoutPort } from './CheckoutPort';
import { appendCheckoutEvents } from './CheckoutEvents';
import { checkoutOperationRequest } from './CheckoutRequest';
import { QuoteDependencyCall } from './QuoteDependencyCall';
import type { CheckoutReservations } from './CheckoutReservations';
import { orderSnapshots, paymentSnapshot } from './CheckoutSnapshots';

export class ConfirmCheckout {
  constructor(
    private readonly checkout: CheckoutPort,
    private readonly members: MemberAccessPort,
    private readonly session: OrderCheckoutSessionPort,
    private readonly pricing: CheckoutPricingPort,
    private readonly cart: CartWritePort,
    private readonly reservations: CheckoutReservations,
    private readonly orders: OrderIntentPort,
    private readonly payment: CheckoutPaymentPort,
    private readonly organization: OrganizationReadPort,
    private readonly outbox: OutboxWriter,
    private readonly policy = new ConfirmQuotePolicy(),
    private readonly calls = new QuoteDependencyCall()
  ) {}

  async execute(request: OperationRequest, transaction: WriteTransactionContext): Promise<OperationResult> {
    const access = requireAccess(request);
    const body = bodyRecord(request.input);
    const quoteId = text(body.quoteId, 'quoteId');
    const tokenDigest = confirmationDigest(text(body.confirmationToken, 'confirmationToken'));
    const idempotency = text(request.input.idempotency, 'idempotency');
    const owner = await this.members.profile(transaction, access.membership.id);
    const personal = access.scope.kind === 'owner' || access.scope.kind === 'self';
    const accessScope = await this.organization.scope(transaction, personal ? owner.organization : organizationScope(access.scope));
    const lock = LockOrderGuard.afterIdempotency();
    lock.advance('quote');
    const session = await this.session.lockQuote(transaction, quoteId, owner.member, owner.organization, tokenDigest);
    const priced = await this.calls.execute('pricing', { expiresAt: request.input.deadline, signal: request.input.signal }, () => this.pricing.quote(transaction, quoteId, owner.member, owner.organization));
    if (priced.signature !== session.quoteHash) throw new DomainError('PRICE_QUOTE_EXPIRED');
    const frozen = this.checkout.restore(priced.payload, priced.signature);
    lock.advance('cart');
    await this.cart.lockActive(transaction, session.cartId, session.memberId, session.mallId, frozen.cart.version);
    const selection = this.checkout.selection(session.input);
    const scopes = Object.freeze([access.scope.id, ...access.scope.path.map(({ id }) => id)]);
    const current = await this.checkout.read(transaction, access.membership.id, selection, {
      expiresAt: request.input.deadline,
      signal: request.input.signal,
      actor: access.actor.id,
      operation: 'order.orders.create',
      trace: access.trace,
      scopes,
    });
    this.policy.assertCurrent(frozen, current, session.expiresAt);
    if (frozen.cart.id !== session.cartId || !accessScope.descendants.includes(frozen.cart.mall)) throw new DomainError('RESOURCE_NOT_FOUND');
    if (frozen.rejections.length > 0) throw new DomainError('LISTING_NOT_PURCHASABLE');
    const order = `order:${randomUUID()}`;
    const payable = Money.of(frozen.payableMinor, frozen.currency);
    assertTenderTotal(frozen, payable);
    const orderScope = frozen.cart.mall === accessScope.id ? accessScope : await this.organization.scope(transaction, frozen.cart.mall);
    let reservationStarted = false;
    try {
      lock.advance('inventory');
      reservationStarted = true;
      await this.reservations.inventoryHold(transaction, order, frozen);
      lock.advance('voucher');
      await this.reservations.voucherHold(transaction, order, frozen);
      lock.advance('marketing');
      await this.reservations.marketingHold(transaction, order, frozen, iso(session.expiresAt));
      lock.advance('benefit');
      await this.reservations.benefitHold(transaction, order, frozen);
      lock.advance('order');
      const snapshots = orderSnapshots(frozen);
      const saved = await this.orders.create(transaction, {
        id: order,
        scope: frozen.cart.mall,
        member: frozen.cart.member,
        checkout: session.checkout,
        money: payable,
        evidence: { quote: session.quoteId, signature: session.quoteHash, dependencies: frozen.evidence, confirmationRisk: current.evidence.risk, selection: frozen.selection, tenders: frozen.tenders },
        address: snapshots.address,
        invoice: snapshots.invoice,
        delivery: frozen.selection.delivery,
        experienceVersion: experienceVersion(frozen),
        lines: frozen.lines,
      });
      lock.advance('payment');
      const prepared = await this.payment.prepare(transaction, {
        order,
        orderNumber: saved.number,
        scope: frozen.cart.mall,
        mall: frozen.cart.mall,
        member: frozen.cart.member,
        currency: payable.currency.code,
        amountMinor: payable.minor,
        idempotency,
        tenders: frozen.tenders,
      });
      const snapshot = paymentSnapshot(this.checkout, frozen, orderScope, order, saved.number);
      const payment = await this.payment.capture(transaction, { payment: prepared, order, scope: frozen.cart.mall, mall: frozen.cart.mall, member: frozen.cart.member, currency: payable.currency.code, amountMinor: payable.minor, snapshot });
      lock.advance('finance');
      await this.orders.scheduleExpiry(transaction, order, frozen.cart.mall);
      await this.session.confirm(transaction, session.checkout);
      await this.cart.convert(transaction, session.cartId);
      lock.advance('audit');
      lock.advance('outbox');
      await appendCheckoutEvents(this.outbox, transaction, request, { checkout: session.checkout, quote: session.quoteId, order, intent: prepared.intent, snapshot, payload: frozen });
      lock.complete();
      return { status: 201, body: { order: saved.record, payment }, headers: { etag: '"0"' } };
    } catch (cause) {
      if (!reservationStarted) throw cause;
      try {
        await this.reservations.release(transaction, order);
      } catch (releaseCause) {
        throw new AggregateError([cause, releaseCause], 'CHECKOUT_COMPENSATION_FAILED');
      }
      throw cause;
    }
  }

  finalizeRequest(input: OperationInputFor<'order.orders.create'>, context: FinalizeContext<'order.orders.create'>, result: OperationReply<OperationOutputFor<'order.orders.create'>>) {
    return this.finalize(checkoutOperationRequest(input, context), result) as Promise<OperationReply<OperationOutputFor<'order.orders.create'>>>;
  }

  async finalize(request: OperationRequest, result: OperationResult): Promise<OperationResult> {
    const body = object(result.body, 'order result');
    const payment = object(body.payment, 'payment');
    if (payment.state !== 'preparing') return result;
    const order = object(body.order, 'order');
    const paymentId = text(payment.paymentId, 'paymentId');
    const expiresAt = text(payment.expiresAt, 'expiresAt');
    const scene = paymentScene(bodyRecord(request.input).paymentScene);
    const prepared: PreparedPayment = Object.freeze({ intent: paymentId, external: true, expiresAt });
    let continued: CheckoutPaymentResult;
    try {
      continued = await this.payment.continue(request, { payment: prepared, order: text(order.id, 'order.id'), scene });
    } catch (cause) {
      if (!(cause instanceof Error) || cause.message !== 'WECHAT_IDENTITY_REQUIRED') throw cause;
      continued = Object.freeze({ paymentId, state: 'recovery' as const, retryAfter: 5 });
    }
    return { ...result, body: { ...body, payment: continued } };
  }
}

function iso(value: Date | string): string {
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error('CHECKOUT_EXPIRY_INVALID');
  return parsed.toISOString();
}
