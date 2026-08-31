import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
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

export interface CheckoutRepository extends OrderCheckoutSessionPort, OrderExpiryCheckoutPort, CheckoutRetentionPort {
  replaceCurrent(
    database: OperationDatabase,
    input: Readonly<{ checkoutId: string; quoteId: string; signature: string; cartId: string; memberId: string; mallId: string; applicationId: string; addressId: string | null; selection: unknown; expiresAt: string }>
  ): Promise<StoredCurrentQuote>;
  current(database: OperationDatabase, member: string, mall: string): Promise<StoredCurrentQuote | null>;
  saveEvidence(database: OperationDatabase, checkout: string, entries: readonly Readonly<{ kind: string; reference: string; version: string; hash: string }>[], expiresAt: string): Promise<void>;
}
