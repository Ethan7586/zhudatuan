import type { StorefrontSession } from '../../../entity/session';
import type { CheckoutPort } from '../public/CheckoutPort';
import type { Quote } from '../model/Quote';
import type { CheckoutDraft } from '../model/CheckoutDraft';

export class CreateQuote {
  constructor(private readonly gateway: Pick<CheckoutPort, 'quote'>) {}
  async execute(
    session: StorefrontSession,
    input: CheckoutDraft
  ): Promise<Quote> {
    return this.gateway.quote(
      session,
      {
        cartVersion: input.cartVersion,
        lines: input.lines.map(({ listingId, quantity, lineVersion }) => ({ listingId, quantity, lineVersion })),
        ...(input.addressId ? { addressId: input.addressId } : {}),
        ...(input.invoiceId ? { invoiceId: input.invoiceId } : {}),
        delivery: {
          method: input.delivery.method,
          ...(input.delivery.note ? { note: input.delivery.note } : {}),
          ...(input.delivery.scheduledAt ? { scheduledAt: input.delivery.scheduledAt } : {}),
        },
        voucherIds: input.voucherIds,
        benefits: input.benefits,
        paymentScene: input.paymentScene,
      },
      crypto.randomUUID()
    );
  }
}
