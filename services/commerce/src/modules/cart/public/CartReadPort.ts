import { publicPort } from '../../../bootstrap/ModuleRegistry';
import type { OperationDatabase } from '../../../foundation/application/ModuleOperations';

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
  current(database: OperationDatabase, member: string, mall: string): Promise<CartSnapshot>;
  read(database: OperationDatabase, cart: string, member: string, mall: string): Promise<CartSnapshot>;
}

export const CART_READ_PORT = publicPort<CartReadPort>('cart', 'read');
