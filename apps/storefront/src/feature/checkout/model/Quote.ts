import type { OperationOutputFor } from '@shop/contract';

type QuoteDto = OperationOutputFor<'checkout.quote.create'>;

export interface QuoteSelection {
  readonly cartVersion: number;
  readonly lines: readonly Readonly<{ listingId: string; quantity: number; lineVersion: number }>[];
  readonly addressId: string | null;
  readonly invoiceId: string | null;
  readonly delivery: Readonly<{ method: QuoteDto['selection']['delivery']['method']; note: string | null; scheduledAt: string | null }>;
  readonly voucherIds: readonly string[];
  readonly benefits: readonly Readonly<{ accountId: string; amountMinor: number }>[];
  readonly paymentScene: QuoteDto['selection']['paymentScene'];
}

export interface Quote {
  readonly checkoutId: string;
  readonly quoteId: string;
  readonly quoteVersion: number;
  readonly confirmationToken: string | null;
  readonly evidenceHash: string;
  readonly expiresAt: string;
  readonly selection: QuoteSelection;
  readonly cartVersion: number;
  readonly lines: readonly Readonly<{ listing: string; quantity: number; payableMinor: number; accepted: boolean; reasons: readonly string[]; versions: Readonly<Record<string, string | number>> }>[];
  readonly subtotalMinor: number;
  readonly discountMinor: number;
  readonly shippingMinor: number;
  readonly taxMinor: number;
  readonly payableMinor: number;
  readonly benefitMinor: number;
  readonly personalMinor: number;
  readonly currency: string;
  readonly tenders: readonly Readonly<{ kind: QuoteDto['tenders'][number]['kind']; reference: string | null; amountMinor: number }>[];
  readonly rejections: readonly Readonly<{ listing: string; reasons: readonly string[] }>[];
}
