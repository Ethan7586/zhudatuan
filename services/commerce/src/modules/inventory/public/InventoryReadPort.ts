import { publicPort } from '../../../bootstrap/ModuleRegistry';
import type { ReadTransactionContext } from '../../../foundation/persistence/TransactionContext';

export interface StorefrontAvailability {
  readonly sku: string;
  readonly available: number;
  readonly state: 'available' | 'unavailable';
  readonly version: string;
}

export interface InventoryReadPort {
  availability(context: ReadTransactionContext, mall: string, skus: readonly string[]): Promise<readonly StorefrontAvailability[]>;
}

export const INVENTORY_READ_PORT = publicPort<InventoryReadPort>('inventory', 'read');
