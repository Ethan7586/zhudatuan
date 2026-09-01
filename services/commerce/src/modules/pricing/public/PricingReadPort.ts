import { publicPort } from '../../../bootstrap/ModuleRegistry';
import type { ReadTransactionContext } from '../../../foundation/persistence/TransactionContext';

export interface StorefrontPrice {
  readonly sku: string;
  readonly amountMinor: number;
  readonly compareMinor: number | null;
  readonly currency: string;
  readonly version: string;
}

export interface PricingReadPort {
  prices(context: ReadTransactionContext, mall: string, skus: readonly string[]): Promise<readonly StorefrontPrice[]>;
}

export const PRICING_READ_PORT = publicPort<PricingReadPort>('pricing', 'read');
