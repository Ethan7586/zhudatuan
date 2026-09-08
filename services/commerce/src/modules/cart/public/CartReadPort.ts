import type { ReadTransactionContext } from '../../../platform/database/TransactionContext';
import { publicPort } from '../../../composition/ModuleRegistry';

export interface CartItemSnapshot {
  readonly listing: string;
  readonly sku: string;
  readonly quantity: number;
  readonly selected: boolean;
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
