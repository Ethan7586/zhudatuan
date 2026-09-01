import type { ReadTransactionContext } from '../../../foundation/persistence/TransactionContext';
import { publicPort } from '../../../bootstrap/ModuleRegistry';

export interface CartItemSnapshot {
  readonly listing: string;
  readonly sku: string;
  readonly title: string;
  readonly quantity: number;
  readonly listingVersion: string;
  readonly unitMinor: number;
  readonly currency: string;
  readonly priceVersion: string;
  readonly version: number;
}

export interface CartSnapshot {
  readonly id: string;
  readonly application: string;
  readonly version: number;
  readonly items: readonly CartItemSnapshot[];
}

export interface CartReadPort {
  current(context: ReadTransactionContext, member: string, mall: string): Promise<CartSnapshot>;
  read(context: ReadTransactionContext, cart: string, member: string, mall: string): Promise<CartSnapshot>;
}

export const CART_READ_PORT = publicPort<CartReadPort>('cart', 'read');
