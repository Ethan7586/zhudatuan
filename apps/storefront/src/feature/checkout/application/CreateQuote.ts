import type { StorefrontSession } from '../../../entity/session';
import type { CheckoutPort } from '../public/CheckoutPort';
import type { Quote } from '../model/Quote';

export class CreateQuote {
  constructor(private readonly gateway: Pick<CheckoutPort, 'quote'>) {}
  async execute(
    session: StorefrontSession,
    input: Readonly<{
      cartVersion: number;
      lines: readonly Readonly<{ listingId: string; quantity: number; lineVersion: number }>[];
      addressId?: string;
      benefits: readonly Readonly<{ id: string; status: string; availableMinor: number }>[];
      paymentScene: 'miniapp' | 'jsapi';
    }>
  ): Promise<Quote> {
    return this.gateway.quote(
      session,
      {
        cartVersion: input.cartVersion,
        lines: input.lines.map(({ listingId, quantity, lineVersion }) => ({ listingId, quantity, lineVersion })),
        ...(input.addressId ? { addressId: input.addressId } : {}),
        delivery: {},
        voucherIds: [],
        benefits: input.benefits.filter(({ status, availableMinor }) => status === 'active' && availableMinor > 0).map(({ id, availableMinor }) => ({ accountId: id, amountMinor: availableMinor })),
        paymentScene: input.paymentScene,
      },
      crypto.randomUUID()
    );
  }
}
