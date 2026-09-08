import type { ReadTransactionContext, WriteTransactionContext } from '../../../platform/database/TransactionContext';
import { publicPort } from '../../../composition/ModuleRegistry';
export type { StockDemand } from './StockDemand';

export interface CheckoutInventoryPort {
  availability(context: ReadTransactionContext, scope: string, skus: readonly string[]): Promise<readonly CheckoutStock[]>;
  reserve(context: WriteTransactionContext, order: string, scope: string, demand: readonly import('./StockDemand').StockDemand[]): Promise<void>;
}
export interface CheckoutStock {
  readonly sku: string;
  readonly stockitem: string;
  readonly onhand: number;
  readonly safety: number;
  readonly reserved: number;
  readonly version: number;
}
export interface PaymentInventoryPort {
  commit(context: WriteTransactionContext, order: string): Promise<void>;
  release(context: WriteTransactionContext, order: string): Promise<void>;
}
export interface ChannelInventoryPort {
  observe(context: WriteTransactionContext, input: Readonly<{ id: string; scope: string; sku: string; location: string; onhand: number; safety: number; provider: string; version: string }>): Promise<void>;
}
export interface OrderExpiryInventoryPort {
  expireCheckout(context: WriteTransactionContext, checkout: string): Promise<void>;
}
export interface CatalogInventoryPort {
  stock(context: ReadTransactionContext, skus: readonly string[], scopes: readonly string[]): Promise<readonly Readonly<Record<string, unknown>>[]>;
}
export const CHECKOUT_INVENTORY_PORT = publicPort<CheckoutInventoryPort>('inventory', 'checkout');
export const PAYMENT_INVENTORY_PORT = publicPort<PaymentInventoryPort>('inventory', 'payment');
export const CATALOG_INVENTORY_PORT = publicPort<CatalogInventoryPort>('inventory', 'catalog');
export const ORDER_EXPIRY_INVENTORY_PORT = publicPort<OrderExpiryInventoryPort>('inventory', 'orderexpiry');
export const PROVIDER_INVENTORY_PORT = publicPort<ChannelInventoryPort>('inventory', 'providersync');
export { INVENTORY_READ_PORT, type InventoryAvailabilityProjection, type InventoryReadPort, type ReservationProjection, type StockSourceProjection, type StorefrontAvailability } from './InventoryReadPort';
