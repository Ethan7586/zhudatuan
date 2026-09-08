import { publicPort } from '../../../composition/ModuleRegistry';
import type { ReadTransactionContext } from '../../../platform/database/TransactionContext';
import type { PriceComponent } from '../domain/value/PriceComponent';

export type { PriceComponent, PriceComponentKind } from '../domain/value/PriceComponent';

export interface StorefrontPrice {
  readonly sku: string;
  readonly amountMinor: number;
  readonly compareMinor: number | null;
  readonly currency: string;
  readonly version: string;
}

export interface EffectiveOffer extends StorefrontPrice {
  readonly scope: string;
  readonly sourceVersion: number;
  readonly breakdown: readonly PriceComponent[];
  readonly status: 'effective';
  readonly effectiveAt: string;
  readonly expiresAt: string | null;
  readonly watermark: string;
}

export interface PricingReadPort {
  prices(context: ReadTransactionContext, mall: string, skus: readonly string[]): Promise<readonly StorefrontPrice[]>;
  offers(context: ReadTransactionContext, scope: string, skus: readonly string[]): Promise<readonly EffectiveOffer[]>;
}

export const PRICING_READ_PORT = publicPort<PricingReadPort>('pricing', 'read');
