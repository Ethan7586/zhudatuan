import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';

import type { CheckoutRetentionPort, OrderExpiryCheckoutPort } from '../../public/CheckoutReadPort';
import type { OrderCheckoutSessionPort } from '../../public/CheckoutWritePort';

export interface StoredCurrentQuote {
  readonly checkoutId: string;
  readonly quoteId: string;
  readonly signature: string;
  readonly expiresAt: Date | string;
  readonly quoteVersion: number;
  readonly payload: unknown;
}

export interface CheckoutSessionStore extends OrderCheckoutSessionPort, OrderExpiryCheckoutPort, CheckoutRetentionPort {
  replaceCurrent(
    context: WriteTransactionContext,
    input: Readonly<{ checkoutId: string; quoteId: string; signature: string; confirmationDigest: string; cartId: string; memberId: string; mallId: string; applicationId: string; addressId: string | null; selection: unknown; expiresAt: string }>
  ): Promise<StoredCurrentQuote>;
  current(context: ReadTransactionContext, member: string, mall: string): Promise<StoredCurrentQuote | null>;
  saveEvidence(context: WriteTransactionContext, checkout: string, entries: readonly Readonly<{ kind: string; reference: string; version: string; hash: string }>[], expiresAt: string): Promise<void>;
}
