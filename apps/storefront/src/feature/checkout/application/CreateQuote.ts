import type { StorefrontSession } from '../../../shared/api/Session';
import { CheckoutGateway } from '../infrastructure/CheckoutGateway';
import { mapQuote } from '../infrastructure/CheckoutMapper';
import type { Quote } from '../model/Quote';

export class CreateQuote {
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
    const value = await CheckoutGateway.quote(
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
    return mapQuote(value);
  }
}
