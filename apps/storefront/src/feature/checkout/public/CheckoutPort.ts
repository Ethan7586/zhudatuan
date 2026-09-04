import type { ContractJsonValue } from '@shop/contract';
import type { StorefrontSession } from '../../../entity/session';
import type { Quote } from '../model/Quote';

export interface QuoteRequest {
  readonly cartVersion: number;
  readonly lines: readonly Readonly<{ listingId: string; quantity: number; lineVersion: number }>[];
  readonly addressId?: string;
  readonly invoiceId?: string;
  readonly delivery: ContractJsonValue;
  readonly voucherIds: readonly string[];
  readonly benefits: readonly Readonly<{ accountId: string; amountMinor: number }>[];
  readonly paymentScene: 'miniapp' | 'jsapi';
}

export interface CommittedOrder {
  readonly orderId: string;
  readonly payment: Readonly<{ paymentId: string }>;
}

export interface CheckoutPort {
  quote(session: StorefrontSession, input: QuoteRequest, idempotencyKey: string): Promise<Quote>;
  current(session: StorefrontSession, signal?: AbortSignal): Promise<Quote | null>;
  commit(session: StorefrontSession, quoteId: string, paymentScene: 'miniapp' | 'jsapi', idempotencyKey: string): Promise<CommittedOrder>;
}
