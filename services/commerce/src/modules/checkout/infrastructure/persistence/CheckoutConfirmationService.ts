import { DomainError } from '../../../../foundation/domain/DomainError';
import { randomUUID } from 'node:crypto';
import { Money } from '@shop/kernel';
import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { FinalizeContext } from '../../../../foundation/application/HandlerContext';
import type { OperationReply } from '../../../../foundation/application/OperationHandler';
import type { OperationRequest, OperationResult } from '../../../../foundation/application/OperationHandler';
import { requireAccess } from '../../../../foundation/application/OperationAccess';
import { PgTransactionAccess, type SqlExecutor } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import { bodyRecord } from '../../../../foundation/interface/Validation';
import type { OutboxWriter } from '../../../../foundation/messaging/Outbox';
import type { CheckoutPort } from '../../application/service/CheckoutPort';
import type { CheckoutQuote } from '../../domain/model/CheckoutQuote';
import type { OrderCheckoutSessionPort } from '../../public/index';
import type { CheckoutInventoryPort } from '../../../inventory/public/index';
import type { CheckoutPaymentPort, CheckoutPaymentResult, PreparedPayment } from '../../../payment/public/index';
import type { BenefitGateway } from '../../../benefit/public/index';
import type { CheckoutMarketingPort } from '../../../marketing/public/index';
import type { CartWritePort } from '../../../cart/public/index';
import type { CheckoutOrderPort } from '../../../order/public/index';
import type { CheckoutInvoicePort } from '../../../finance/public/index';
import type { OrganizationReadPort, OrganizationScopeSnapshot } from '../../../organization/public/index';
import type { MemberAccessPort } from '../../../access/public';
import type { MemberAddressPort } from '../../../member/public';
import type { CheckoutPricingPort } from '../../../pricing/public';
import type { CheckoutRiskPort } from '../../../risk/public';
import { organizationScope } from '../../../../foundation/security/OrganizationScope';
import { LockOrderGuard } from '../../domain/policy/LockOrderGuard';
import { assertTenderTotal, byReference, experienceVersion, integer, object, paymentScene, text } from '../../domain/policy/ConfirmQuotePolicy';
import { appendCheckoutEvents } from './CheckoutEvents';
import { checkoutOperationRequest } from './CheckoutConfirmation';

export interface VoucherHoldPort {
  reserve(context: WriteTransactionContext, order: string, member: string, scope: string, tenders: readonly Readonly<{ reference: string; amountMinor: number }>[]): Promise<void>;
}

export class CheckoutConfirmationService {
  private readonly transactions = new PgTransactionAccess();
  constructor(
    private readonly checkout: CheckoutPort,
    private readonly members: MemberAccessPort,
    private readonly session: OrderCheckoutSessionPort,
    private readonly pricing: CheckoutPricingPort,
    private readonly address: MemberAddressPort,
    private readonly cart: CartWritePort,
    private readonly inventory: CheckoutInventoryPort,
    private readonly benefit: Pick<BenefitGateway, 'reserve'>,
    private readonly voucher: VoucherHoldPort,
    private readonly marketing: CheckoutMarketingPort,
    private readonly orders: CheckoutOrderPort,
    private readonly payment: CheckoutPaymentPort,
    private readonly invoice: CheckoutInvoicePort,
    private readonly organization: OrganizationReadPort,
    private readonly risk: CheckoutRiskPort,
    private readonly outbox: OutboxWriter
  ) {}

  async execute(request: OperationRequest, transaction: WriteTransactionContext): Promise<OperationResult> {
    const database = this.transactions.database(transaction);
    const access = requireAccess(request);
    if (access.assurance.level < 2) throw new Error('MOBILE_ASSURANCE_REQUIRED');
    const body = bodyRecord(request.input);
    const quoteid = text(body.quoteId, 'quoteId');
    const owner = await this.members.profile(transaction, access.membership.id);
    const lock = LockOrderGuard.afterIdempotency();
    const personal = access.scope.kind === 'owner' || access.scope.kind === 'self';
    const accessScope = await this.organization.scope(transaction, personal ? owner.organization : organizationScope(access.scope));
    lock.advance('quote');
    const session = await this.session.lockQuote(transaction, quoteid, owner.member, owner.organization);
    const storedPrice = await this.pricing.quote(transaction, quoteid, owner.member, owner.organization);
    if (storedPrice.signature !== session.quoteHash) throw new Error('QUOTE_SIGNATURE_INVALID');
    const signed = this.checkout.restore(storedPrice.payload, storedPrice.signature);
    const stored = Object.freeze({ ...session, signedPayload: signed, signature: storedPrice.signature });
    lock.advance('cart');
    await this.cart.lockActive(transaction, stored.cartId, stored.memberId, stored.mallId, signed.cart.version);
    const selection = this.checkout.selection(stored.input);
    const current = await this.checkout.read(transaction, access.membership.id, selection, { expiresAt: request.input.deadline, signal: request.input.signal });
    if (current.cart.id !== stored.cartId || this.checkout.sign(current) !== stored.signature) throw new DomainError('PRICE_QUOTE_EXPIRED');
    if (!accessScope.descendants.includes(current.cart.mall)) throw new DomainError('RESOURCE_NOT_FOUND');
    if (current.rejections.length > 0) throw new Error(`CHECKOUT_REJECTED:${current.rejections.map(({ listing, reasons }) => `${listing}:${reasons.join(',')}`).join(';')}`);
    const order = `order:${randomUUID()}`;
    const payable = Money.of(current.payableMinor, current.currency);
    assertTenderTotal(current, payable);
    const snapshots = await this.snapshots(transaction, current);
    const orderScope = current.cart.mall === accessScope.id ? accessScope : await this.organization.scope(transaction, current.cart.mall);
    await this.session.confirm(transaction, stored.checkout);
    await this.cart.convert(transaction, stored.cartId);
    lock.advance('inventory');
    await this.inventory.reserve(transaction, order, current.cart.mall, current.lines);
    lock.advance('voucher');
    await this.reserveVouchers(transaction, order, current);
    lock.advance('benefit');
    await this.reserveBenefits(transaction, order, current);
    await this.reserveMarketing(transaction, order, current);
    const assessment = await this.risk.assess(transaction, {
      actor: access.actor.id,
      operation: 'order.orders.create',
      resource: order,
      scope: current.cart.mall,
      scopes: Object.freeze([orderScope.id, ...orderScope.ancestors]),
      trace: access.trace,
      amountMinor: payable.minor,
      signals: Object.freeze({ checkoutlines: current.lines.length, checkouttenders: current.tenders.length }),
    });
    if (assessment.outcome !== 'allow') {
      const code = assessment.outcome === 'challenge' ? 'STEPUP_REQUIRED' : assessment.outcome === 'review' ? 'RISK_REVIEW_REQUIRED' : 'RISK_DENIED';
      throw new DomainError(code, { reason: assessment.safeReason, decision: assessment.decision });
    }
    lock.advance('order');
    const saved = await this.orders.create(transaction, {
      id: order,
      scope: current.cart.mall,
      member: current.cart.member,
      checkout: stored.checkout,
      money: payable,
      evidence: { quote: stored.quoteId, signature: stored.signature, dependencies: current.evidence, selection: current.selection, tenders: current.tenders, risk: assessment },
      address: snapshots.address,
      invoice: snapshots.invoice,
      delivery: current.selection.delivery,
      experienceVersion: experienceVersion(current),
      lines: current.lines,
    });
    lock.advance('payment');
    const prepared = await this.payment.prepare(transaction, {
      order,
      orderNumber: saved.number,
      scope: current.cart.mall,
      mall: current.cart.mall,
      member: current.cart.member,
      currency: payable.currency.code,
      amountMinor: payable.minor,
      idempotency: request.input.idempotency!,
      tenders: current.tenders,
    });
    const snapshot = this.paymentSnapshot(current, orderScope, order, saved.number);
    const payment = await this.payment.capture(transaction, {
      payment: prepared,
      order,
      scope: current.cart.mall,
      mall: current.cart.mall,
      member: current.cart.member,
      currency: payable.currency.code,
      amountMinor: payable.minor,
      snapshot,
    });
    lock.advance('finance');
    await this.orders.scheduleExpiry(transaction, order, current.cart.mall);
    lock.advance('audit');
    lock.advance('outbox');
    await appendCheckoutEvents(this.outbox, transaction, request, { checkout: stored.checkout, quote: stored.quoteId, order, intent: prepared.intent, snapshot, payload: current });
    lock.complete();
    return { status: 201, body: { order: saved.record, payment }, headers: { etag: '"0"' } };
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

  private async reserveVouchers(context: WriteTransactionContext, order: string, quote: CheckoutQuote): Promise<void> {
    const tenders = quote.tenders.filter((item) => item.kind === 'voucher').sort(byReference);
    await this.voucher.reserve(
      context,
      order,
      quote.cart.member,
      quote.cart.mall,
      tenders.map(({ reference, amountMinor }) => ({ reference: reference!, amountMinor }))
    );
  }

  private async reserveBenefits(context: WriteTransactionContext, order: string, quote: CheckoutQuote): Promise<void> {
    const tenders = quote.tenders.filter((item) => item.kind === 'benefit').sort(byReference);
    await this.benefit.reserve(
      context,
      order,
      quote.cart.member,
      quote.cart.mall,
      tenders.map(({ reference, amountMinor }) => ({ reference: reference!, amountMinor }))
    );
  }

  private async reserveMarketing(context: WriteTransactionContext, order: string, quote: CheckoutQuote): Promise<void> {
    const values = Array.isArray(quote.evidence.marketing) ? (quote.evidence.marketing as readonly Readonly<Record<string, unknown>>[]) : [];
    for (const value of [...values].sort((left, right) => String(left.id).localeCompare(String(right.id)))) {
      const id = text(value.id, 'campaign');
      const amount = integer(value.discount, 'campaign.discount');
      await this.marketing.reserve(context, { campaign: id, member: quote.cart.member, order, scope: quote.cart.mall, amountMinor: amount });
    }
  }

  private async snapshots(context: ReadTransactionContext, quote: CheckoutQuote): Promise<Readonly<{ address: unknown; invoice: unknown }>> {
    const address = await this.address.snapshot(context, quote.selection.addressId, quote.cart.member);
    const invoice = await this.invoice.snapshot(context, quote.selection.invoiceId, quote.cart.member);
    if (quote.selection.addressId !== null && !address) throw new Error('CHECKOUT_ADDRESS_INVALID');
    if (quote.selection.invoiceId !== null && !invoice) throw new Error('CHECKOUT_INVOICE_INVALID');
    return Object.freeze({ address: address ?? null, invoice: invoice ?? null });
  }

  private paymentSnapshot(quote: CheckoutQuote, scope: OrganizationScopeSnapshot, order: string, number: string) {
    return Object.freeze({
      order,
      number,
      member: quote.cart.member,
      mall: quote.cart.mall,
      application: quote.cart.application,
      scopes: Object.freeze([scope.id, ...scope.ancestors]),
      timezone: scope.timezone,
      totalMinor: quote.payableMinor,
      currency: quote.currency,
      evidenceHash: this.checkout.digest(quote.evidence),
      tenders: quote.tenders,
      lines: quote.lines.map(({ listing, sku, product, category, provider, partner, totalMinor, discountMinor, payableMinor }) => ({
        line: listing,
        sku,
        product,
        category,
        provider,
        partner,
        totalMinor,
        discountMinor,
        payableMinor,
      })),
    });
  }
}
