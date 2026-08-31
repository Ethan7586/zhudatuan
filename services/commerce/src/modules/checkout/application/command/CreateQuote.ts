import { randomUUID } from 'node:crypto';
import type { Clock } from '../../../../foundation/domain/Clock';
import { domainEvent } from '../../../../foundation/domain/DomainEvent';
import type { OutboxWriter } from '../../../../foundation/messaging/Outbox';
import type { OperationRequest, OperationResult } from '../../../../foundation/application/OperationExecution';
import { requireAccess, type OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import { bodyRecord } from '../../../../foundation/interface/Validation';
import type { CheckoutPricingPort } from '../../../pricing/public';
import type { CheckoutPort } from '../../CheckoutPort';
import { quoteResult } from '../QuoteResult';
import type { CheckoutRepository } from '../port/CheckoutRepository';

export class CreateQuote {
  constructor(
    private readonly checkout: CheckoutPort,
    private readonly pricing: CheckoutPricingPort,
    private readonly repository: CheckoutRepository,
    private readonly outbox: OutboxWriter,
    private readonly clock: Clock
  ) {}

  async execute(request: OperationRequest, database: OperationDatabase): Promise<OperationResult> {
    const access = requireAccess(request);
    const selection = this.checkout.selection(bodyRecord(request));
    const quote = await this.checkout.read(database, access.membership.id, selection, { expiresAt: request.input.deadline, signal: request.input.signal });
    const quoteId = `quote:${randomUUID()}`;
    const checkoutId = `checkout:${randomUUID()}`;
    const signature = this.checkout.sign(quote);
    const evidenceHash = this.checkout.digest(quote.evidence);
    const expiresAt = new Date(this.clock.now().getTime() + 15 * 60_000).toISOString();
    await this.pricing.saveQuote(database, {
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
    const stored = await this.repository.replaceCurrent(database, {
      checkoutId,
      quoteId,
      signature,
      cartId: quote.cart.id,
      memberId: quote.cart.member,
      mallId: quote.cart.mall,
      applicationId: quote.cart.application,
      addressId: selection.addressId,
      selection,
      expiresAt,
    });
    await this.repository.saveEvidence(database, checkoutId, evidenceEntries(checkoutId, quote.evidence, this.checkout), expiresAt);
    await this.outbox.append(
      database,
      domainEvent({
        event: `event:${randomUUID()}`,
        type: 'checkout.quote.created',
        version: 1,
        aggregate: { type: 'checkout', id: checkoutId, version: 1 },
        tenant: quote.cart.mall,
        occurred: this.clock.now().toISOString(),
        trace: access.trace,
        payload: { checkout: checkoutId, quote: quoteId, member: quote.cart.member, mall: quote.cart.mall, payableMinor: quote.payableMinor, personalMinor: quote.personalMinor, currency: quote.currency, expiresAt, evidenceHash },
      })
    );
    return { status: 201, body: quoteResult({ ...stored, payload: quote }, quote), headers: { etag: `"${stored.quoteVersion}"` } };
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
