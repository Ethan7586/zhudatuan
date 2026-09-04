import { randomUUID } from 'node:crypto';
import type { Clock } from '../../../../foundation/domain/Clock';
import { domainEvent } from '../../../../foundation/domain/DomainEvent';
import type { OutboxWriter } from '../../../../foundation/messaging/Outbox';
import type { OperationRequest, OperationResult } from '../../../../foundation/application/OperationRequest';
import { requireAccess } from '../../../../foundation/application/OperationAccess';
import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import { bodyRecord } from '../../../../foundation/application/Validation';
import type { CheckoutPricingPort } from '../../../pricing/public';
import type { CheckoutPort } from '../../application/service/CheckoutPort';
import { quoteResult } from '../../application/service/QuoteResult';
import type { CheckoutSessionStore } from '../../application/port/CheckoutSessionStore';
import { CheckoutPolicy } from '../../domain/policy/CheckoutPolicy';
import { confirmationDigest, issueConfirmationToken } from '../../domain/model/ConfirmationToken';

export class QuoteCreator {
  constructor(
    private readonly checkout: CheckoutPort,
    private readonly pricing: CheckoutPricingPort,
    private readonly repository: CheckoutSessionStore,
    private readonly outbox: OutboxWriter,
    private readonly clock: Clock,
    private readonly policy = new CheckoutPolicy()
  ) {}

  async execute(request: OperationRequest, context: WriteTransactionContext): Promise<OperationResult> {
    const access = requireAccess(request);
    const selection = this.checkout.selection(bodyRecord(request.input));
    const quote = await this.checkout.read(context, access.membership.id, selection, {
      expiresAt: request.input.deadline,
      signal: request.input.signal,
      actor: access.actor.id,
      operation: 'checkout.quote.create',
      trace: access.trace,
      scopes: Object.freeze([access.scope.id, ...access.scope.path.map(({ id }) => id)]),
    });
    const quoteId = `quote:${randomUUID()}`;
    const checkoutId = `checkout:${randomUUID()}`;
    const confirmationToken = issueConfirmationToken();
    const signature = this.checkout.sign(quote);
    const evidenceHash = this.checkout.digest(quote.evidence);
    const now = this.clock.now();
    const expiresAt = this.policy.expiresAt(now);
    await this.pricing.saveQuote(context, {
      id: quoteId,
      member: quote.cart.member,
      mall: quote.cart.mall,
      currency: quote.currency,
      subtotalMinor: quote.subtotalMinor,
      discountMinor: quote.discountMinor,
      payableMinor: quote.payableMinor,
      lines: quote.lines,
      evidenceHash,
      evidence: quote.evidence,
      payload: quote,
      signature,
      expiresAt,
    });
    const stored = await this.repository.replaceCurrent(context, {
      checkoutId,
      quoteId,
      signature,
      confirmationDigest: confirmationDigest(confirmationToken),
      cartId: quote.cart.id,
      memberId: quote.cart.member,
      mallId: quote.cart.mall,
      applicationId: quote.cart.application,
      addressId: selection.addressId,
      selection,
      expiresAt,
    });
    await this.repository.saveEvidence(context, checkoutId, evidenceEntries(checkoutId, quote.evidence, this.checkout), expiresAt);
    await this.outbox.append(
      context,
      domainEvent({
        event: `event:${randomUUID()}`,
        type: 'checkout.quote.created',
        version: 1,
        aggregate: { type: 'checkout', id: checkoutId, version: 1 },
        tenant: quote.cart.mall,
        occurred: now.toISOString(),
        trace: access.trace,
        payload: { checkout: checkoutId, quote: quoteId, member: quote.cart.member, mall: quote.cart.mall, payableMinor: quote.payableMinor, personalMinor: quote.personalMinor, currency: quote.currency, expiresAt, evidenceHash },
      })
    );
    return { status: 201, body: quoteResult({ ...stored, payload: quote }, quote, confirmationToken), headers: { etag: `"${stored.quoteVersion}"` } };
  }
}

function evidenceEntries(checkoutId: string, evidence: Readonly<Record<string, unknown>>, checkout: CheckoutPort) {
  return Object.entries(evidence)
    .sort(([left], [right]) => left.localeCompare(right))
    .flatMap(([kind, value]) => {
      const records = Array.isArray(value) ? value : value === null ? [] : [value];
      return records.map((payload, index) => {
        const record = payload !== null && typeof payload === 'object' && !Array.isArray(payload) ? (payload as Readonly<Record<string, unknown>>) : {};
        return Object.freeze({ kind, reference: typeof record.id === 'string' ? record.id : `${checkoutId}:${kind}:${index}`, version: String(record.version ?? record.hash ?? '1'), hash: checkout.digest(payload) });
      });
    });
}
