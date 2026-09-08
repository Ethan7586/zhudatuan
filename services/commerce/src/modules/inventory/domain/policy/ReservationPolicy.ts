import { DomainError } from '../../../../platform/error/DomainError';
import type { StockDemand } from '../model/StockDemand';
import type { StockItem } from '../model/StockItem';

export interface ReservationDemand {
  readonly sku: string;
  readonly listing: string;
  readonly stockitem: string;
  readonly quantity: number;
}

export class ReservationPolicy {
  demands(values: readonly StockDemand[]): readonly ReservationDemand[] {
    const selected = new Map<string, ReservationDemand>();
    for (const value of values.filter(({ accepted }) => accepted)) {
      if (value.stockitem === null || !Number.isSafeInteger(value.quantity) || value.quantity < 1) throw new DomainError('INVENTORY_QUANTITY_INVALID');
      const prior = selected.get(value.stockitem);
      if (prior && prior.sku !== value.sku) throw new DomainError('INVENTORY_BALANCE_INVALID');
      const quantity = (prior?.quantity ?? 0) + value.quantity;
      if (!Number.isSafeInteger(quantity)) throw new DomainError('INVENTORY_QUANTITY_INVALID');
      selected.set(value.stockitem, Object.freeze({ sku: value.sku, listing: prior?.listing ?? value.listing, stockitem: value.stockitem, quantity }));
    }
    return Object.freeze([...selected.values()].sort((left, right) => left.stockitem.localeCompare(right.stockitem)));
  }

  reserve(stock: StockItem, activeReserved: number, quantity: number, at: string): StockItem {
    return stock.reserve(quantity, activeReserved, at);
  }
}
