import type { OperationBodyFor } from '@shop/contract';
import type { StorefrontSession } from '../../../entity/session';
import type { Quote } from '../model/Quote';

type QuoteBody = OperationBodyFor<'CheckoutQuoteCreateInput'>;
export type PaymentScene = QuoteBody['paymentScene'];
export type DeliveryMethod = NonNullable<QuoteBody['delivery']['method']>;

export interface QuoteRequest {
  readonly cartVersion: number;
  readonly lines: readonly Readonly<{ listingId: string; quantity: number; lineVersion: number }>[];
  readonly addressId?: string;
  readonly invoiceId?: string;
  readonly delivery: Readonly<{ method?: DeliveryMethod; note?: string; scheduledAt?: string }>;
  readonly voucherIds: readonly string[];
  readonly benefits: readonly Readonly<{ accountId: string; amountMinor: number }>[];
  readonly paymentScene: PaymentScene;
}

export interface CommittedOrder {
  readonly orderId: string;
  readonly payment: Readonly<{ paymentId: string }>;
}

export interface CheckoutPort {
  quote(session: StorefrontSession, input: QuoteRequest, idempotencyKey: string): Promise<Quote>;
  current(session: StorefrontSession, signal?: AbortSignal): Promise<Quote | null>;
  commit(session: StorefrontSession, quoteId: string, confirmationToken: string, paymentScene: PaymentScene, idempotencyKey: string): Promise<CommittedOrder>;
}
