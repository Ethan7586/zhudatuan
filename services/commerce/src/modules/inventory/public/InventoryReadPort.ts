import { publicPort } from '../../../composition/ModuleRegistry';
import type { ReadTransactionContext } from '../../../platform/database/TransactionContext';

export interface StorefrontAvailability {
  readonly sku: string;
  readonly available: number;
  readonly state: 'available' | 'unavailable';
  readonly version: string;
}

export interface StockSourceProjection {
  readonly id: string;
  readonly source: string;
  readonly reference: string | null;
  readonly location: string;
  readonly onhand: number;
  readonly safety: number;
  readonly reserved: number;
  readonly available: number;
  readonly state: 'active' | 'blocked' | 'retired';
  readonly version: string;
  readonly watermark: string;
}

export interface ReservationProjection {
  readonly activeCount: number;
  readonly activeQuantity: number;
  readonly earliestExpiry: string | null;
}

export interface InventoryAvailabilityProjection {
  readonly sku: string;
  readonly scope: string;
  readonly onhand: number;
  readonly safety: number;
  readonly reserved: number;
  readonly available: number;
  readonly state: 'available' | 'unavailable' | 'blocked';
  readonly version: string;
  readonly reservation: ReservationProjection;
  readonly sources: readonly StockSourceProjection[];
  readonly watermark: string;
}

export interface InventoryReadPort {
  availability(context: ReadTransactionContext, mall: string, skus: readonly string[]): Promise<readonly StorefrontAvailability[]>;
  details(context: ReadTransactionContext, scope: string, skus: readonly string[], source: string | null): Promise<readonly InventoryAvailabilityProjection[]>;
}

export const INVENTORY_READ_PORT = publicPort<InventoryReadPort>('inventory', 'read');
