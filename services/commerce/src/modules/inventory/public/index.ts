import { publicPort } from '../../../bootstrap/ModuleRegistry';
export type { StockDemand } from '../InventoryPort';
import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';
export interface CheckoutInventoryPort {
  availability(database: OperationDatabase, scope: string, skus: readonly string[]): Promise<readonly CheckoutStock[]>;
  reserve(database: OperationDatabase, order: string, scope: string, demand: readonly import('../InventoryPort').StockDemand[]): Promise<void>;
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
  commit(database: OperationDatabase, order: string): Promise<void>;
  release(database: OperationDatabase, order: string): Promise<void>;
}
export interface ChannelInventoryPort {
  observe(database: OperationDatabase, input: Readonly<{ id: string; scope: string; sku: string; location: string; onhand: number; safety: number; provider: string; version: string }>): Promise<void>;
}
export interface OrderExpiryInventoryPort {
  expireCheckout(database: OperationDatabase, checkout: string): Promise<void>;
}
export interface CatalogInventoryPort {
  stock(database: OperationDatabase, skus: readonly string[], scopes: readonly string[]): Promise<readonly Readonly<Record<string, unknown>>[]>;
}
export const CHECKOUT_INVENTORY_PORT = publicPort<CheckoutInventoryPort>('inventory', 'checkout');
export const PAYMENT_INVENTORY_PORT = publicPort<PaymentInventoryPort>('inventory', 'payment');
export const CATALOG_INVENTORY_PORT = publicPort<CatalogInventoryPort>('inventory', 'catalog');
export { INVENTORY_READ_PORT, PgInventoryReadPort, type InventoryReadPort, type StorefrontAvailability } from './InventoryReadPort';
