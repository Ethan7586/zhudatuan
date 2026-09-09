import { DomainError } from '../../../../platform/error/DomainError';

export type StockItemState = 'active' | 'blocked' | 'retired';

export interface StockItemSnapshot {
  readonly id: string;
  readonly scope: string;
  readonly sku: string;
  readonly location: string;
  readonly onhand: number;
  readonly safety: number;
  readonly state: StockItemState;
  readonly version: number;
  readonly updatedAt: string;
}

export class StockItem {
  private constructor(private readonly value: StockItemSnapshot) {
    validate(value);
    Object.freeze(this);
  }

  static create(input: Omit<StockItemSnapshot, 'version'>): StockItem {
    return new StockItem(freeze({ ...input, version: 1, updatedAt: iso(input.updatedAt) }));
  }

  static restore(value: StockItemSnapshot): StockItem {
    return new StockItem(freeze(value));
  }

  available(activeReserved: number): number {
    quantity(activeReserved, false, 'reserved');
    return this.value.state === 'active' ? Math.max(0, this.value.onhand - activeReserved - this.value.safety) : 0;
  }

  reserve(quantityValue: number, activeReserved: number, at: string): StockItem {
    quantity(quantityValue, true, 'quantity');
    if (this.available(activeReserved) < quantityValue) throw new DomainError('INVENTORY_INSUFFICIENT');
    return this.touch(at);
  }

  confirm(quantityValue: number, at: string): StockItem {
    quantity(quantityValue, true, 'quantity');
    if (this.value.state !== 'active' || this.value.onhand < quantityValue) throw new DomainError('INVENTORY_INSUFFICIENT');
    return new StockItem(freeze({ ...this.value, onhand: this.value.onhand - quantityValue, version: this.value.version + 1, updatedAt: iso(at) }));
  }

  release(at: string): StockItem {
    return this.touch(at);
  }

  observe(input: Readonly<{ onhand: number; safety: number; state?: StockItemState; at: string }>, activeReserved: number): StockItem {
    quantity(input.onhand, false, 'onhand');
    quantity(input.safety, false, 'safety');
    quantity(activeReserved, false, 'reserved');
    const state = input.state ?? 'active';
    if (this.value.state === 'retired' && state !== 'retired') throw new DomainError('INVENTORY_BALANCE_INVALID');
    if (input.onhand === this.value.onhand && input.safety === this.value.safety && state === this.value.state) return this;
    return new StockItem(freeze({ ...this.value, onhand: input.onhand, safety: input.safety, state, version: this.value.version + 1, updatedAt: iso(input.at) }));
  }

  restock(quantityValue: number, at: string): StockItem {
    quantity(quantityValue, true, 'quantity');
    const onhand = this.value.onhand + quantityValue;
    if (!Number.isSafeInteger(onhand)) throw new DomainError('INVENTORY_BALANCE_INVALID');
    return new StockItem(freeze({ ...this.value, onhand, version: this.value.version + 1, updatedAt: iso(at) }));
  }

  snapshot(): StockItemSnapshot {
    return this.value;
  }

  private touch(at: string): StockItem {
    return new StockItem(freeze({ ...this.value, version: this.value.version + 1, updatedAt: iso(at) }));
  }
}

export function available(onhand: number, activeReserved: number, safety: number): number {
  quantity(onhand, false, 'onhand');
  quantity(activeReserved, false, 'reserved');
  quantity(safety, false, 'safety');
  return Math.max(0, onhand - activeReserved - safety);
}

function validate(value: StockItemSnapshot): void {
  if (!/^stock:[A-Za-z0-9][A-Za-z0-9.:/-]*$/.test(value.id) || !value.scope || !foreignIdentity(value.sku) || !value.location) invalid('identity');
  quantity(value.onhand, false, 'onhand');
  quantity(value.safety, false, 'safety');
  if (!['active', 'blocked', 'retired'].includes(value.state)) invalid('state');
  if (!Number.isSafeInteger(value.version) || value.version < 1) invalid('version');
  iso(value.updatedAt);
}

function foreignIdentity(value: string): boolean {
  return /^[^\s,]{1,256}$/.test(value);
}

function quantity(value: number, positive: boolean, field: string): void {
  if (!Number.isSafeInteger(value) || value < (positive ? 1 : 0)) invalid(field);
}
function iso(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) invalid('time');
  return date.toISOString();
}
function freeze(value: StockItemSnapshot): StockItemSnapshot {
  return Object.freeze({ ...value });
}
function invalid(field: string): never {
  throw new DomainError('INVENTORY_BALANCE_INVALID', { field });
}
