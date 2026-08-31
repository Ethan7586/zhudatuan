import { publicPort } from '../../../bootstrap/ModuleRegistry';
export type { ProviderPrice } from '../PricingPort';
import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';
export interface CheckoutPricingPort {
  offers(database: OperationDatabase, scope: string, skus: readonly string[]): Promise<readonly CheckoutPrice[]>;
  rules(database: OperationDatabase, scope: string): Promise<readonly CheckoutPriceRule[]>;
  quote(database: OperationDatabase, quote: string, member: string, mall: string): Promise<StoredPriceQuote>;
  saveQuote(
    database: OperationDatabase,
    input: Readonly<{
      id: string;
      member: string;
      mall: string;
      currency: string;
      subtotalMinor: number;
      discountMinor: number;
      payableMinor: number;
      lines: unknown;
      evidenceHash: string;
      evidence: unknown;
      payload: unknown;
      signature: string;
      expiresAt: string;
    }>
  ): Promise<void>;
}
export interface CheckoutPrice {
  readonly sku: string;
  readonly amountMinor: number;
  readonly currency: string;
  readonly version: string;
}
export interface CheckoutPriceRule {
  readonly id: string;
  readonly version: number;
  readonly priority: number;
  readonly kind: string;
  readonly condition: unknown;
  readonly effect: unknown;
}
export interface StoredPriceQuote {
  readonly id: string;
  readonly member: string;
  readonly mall: string;
  readonly payload: unknown;
  readonly signature: string;
}
export interface ChannelPricingPort {
  ensureProviderBook(database: OperationDatabase, id: string, scope: string, provider: string): Promise<void>;
  saveProviderPrice(database: OperationDatabase, input: import('../PricingPort').ProviderPrice): Promise<void>;
}
export interface PricingRetentionPort {
  purgeQuotes(database: OperationDatabase, retained?: readonly string[]): Promise<void>;
}
export interface CartPricingPort {
  current(database: OperationDatabase, scope: string, sku: string): Promise<Readonly<{ amountMinor: number; currency: string; version: string }> | null>;
  currentMany(database: OperationDatabase, scope: string, skus: readonly string[]): Promise<ReadonlyMap<string, Readonly<{ amountMinor: number; currency: string; version: string }>>>;
}
export interface CatalogPricingPort {
  prices(database: OperationDatabase, skus: readonly string[], scopes: readonly string[]): Promise<readonly Readonly<Record<string, unknown>>[]>;
}
export const CHECKOUT_PRICING_PORT = publicPort<CheckoutPricingPort>('pricing', 'checkout');
export const CART_PRICING_PORT = publicPort<CartPricingPort>('pricing', 'cart');
export const CATALOG_PRICING_PORT = publicPort<CatalogPricingPort>('pricing', 'catalog');
export { PRICING_READ_PORT, PgPricingReadPort, type PricingReadPort, type StorefrontPrice } from './PricingReadPort';
