import type { ReadTransactionContext, WriteTransactionContext } from '../../../foundation/persistence/TransactionContext';
import { publicPort } from '../../../bootstrap/ModuleRegistry';
export type { ProviderPrice } from './ProviderPrice';

export interface CheckoutPricingPort {
  offers(context: ReadTransactionContext, scope: string, skus: readonly string[]): Promise<readonly CheckoutPrice[]>;
  quote(context: ReadTransactionContext, quote: string, member: string, mall: string): Promise<StoredPriceQuote>;
  saveQuote(
    context: ReadTransactionContext,
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
  readonly compareMinor: number | null;
  readonly currency: string;
  readonly version: string;
  readonly breakdown: readonly import('./PricingReadPort').PriceComponent[];
  readonly watermark: string;
}
export interface StoredPriceQuote {
  readonly id: string;
  readonly member: string;
  readonly mall: string;
  readonly payload: unknown;
  readonly signature: string;
}
export interface ChannelPricingPort {
  ensureProviderBook(context: WriteTransactionContext, id: string, scope: string, provider: string): Promise<void>;
  saveProviderPrice(context: WriteTransactionContext, input: import('./ProviderPrice').ProviderPrice): Promise<void>;
}
export interface PricingRetentionPort {
  purgeQuotes(context: WriteTransactionContext, retained?: readonly string[]): Promise<void>;
}
export const RUNTIME_PRICING_PORT = publicPort<PricingRetentionPort>('pricing', 'runtime');
export const PROVIDER_PRICING_PORT = publicPort<ChannelPricingPort>('pricing', 'providersync');
export interface CartPricingPort {
  current(context: ReadTransactionContext, scope: string, sku: string): Promise<Readonly<{ amountMinor: number; currency: string; version: string }> | null>;
  currentMany(context: ReadTransactionContext, scope: string, skus: readonly string[]): Promise<ReadonlyMap<string, Readonly<{ amountMinor: number; currency: string; version: string }>>>;
}
export interface CatalogPricingPort {
  prices(context: ReadTransactionContext, skus: readonly string[], scopes: readonly string[]): Promise<readonly Readonly<Record<string, unknown>>[]>;
}
export interface CatalogPriceCommandPort {
  setPrice(context: WriteTransactionContext, input: Readonly<{ scope: string; sku: string; amountMinor: number; currency: 'CNY'; expectedVersion: number }>): Promise<Readonly<{ sku: string; scope: string; amountMinor: number; currency: 'CNY'; version: number; effectiveAt: string; updatedAt: string }>>;
}
export const CATALOG_PRICE_COMMAND_PORT = publicPort<CatalogPriceCommandPort>('pricing', 'catalogcommand');
export const CHECKOUT_PRICING_PORT = publicPort<CheckoutPricingPort>('pricing', 'checkout');
export const CART_PRICING_PORT = publicPort<CartPricingPort>('pricing', 'cart');
export const CATALOG_PRICING_PORT = publicPort<CatalogPricingPort>('pricing', 'catalog');
export { PRICING_READ_PORT, type EffectiveOffer, type PriceComponent, type PriceComponentKind, type PricingReadPort, type StorefrontPrice } from './PricingReadPort';
