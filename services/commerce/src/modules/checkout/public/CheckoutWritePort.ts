import type { WriteTransactionContext } from '../../../foundation/persistence/TransactionContext';

export interface StoredCheckoutQuote {
  readonly checkout: string;
  readonly cartId: string;
  readonly memberId: string;
  readonly mallId: string;
  readonly applicationId: string;
  readonly quoteId: string;
  readonly quoteHash: string;
  readonly input: Readonly<Record<string, unknown>>;
  readonly version: number;
}

export interface OrderCheckoutSessionPort {
  lockQuote(context: WriteTransactionContext, quote: string, member: string, mall: string): Promise<StoredCheckoutQuote>;
  confirm(context: WriteTransactionContext, checkout: string): Promise<void>;
}
