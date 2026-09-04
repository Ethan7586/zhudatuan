import type { Package, PackageLine } from './Package';

export interface ShipmentSnapshot {
  readonly id: string;
  readonly fulfillment: string;
  readonly state: 'draft' | 'shipped' | 'delivered' | 'cancelled';
  readonly limits: readonly PackageLine[];
  readonly packages: readonly Package[];
  readonly version: number;
}

export class Shipment {
  private constructor(readonly value: Readonly<ShipmentSnapshot>) {}

  static create(value: ShipmentSnapshot): Shipment {
    if (!value.id || !value.fulfillment || !Number.isSafeInteger(value.version) || value.version < 0 || value.limits.length === 0) throw new Error('FULFILLMENT_SHIPMENT_INVALID');
    if (new Set(value.limits.map(({ line }) => line)).size !== value.limits.length || value.limits.some(({ line, quantity }) => !line || !Number.isSafeInteger(quantity) || quantity <= 0)) throw new Error('FULFILLMENT_SHIPMENT_LINES_INVALID');
    const shipment = new Shipment(Object.freeze({ ...value, limits: Object.freeze(value.limits.map((line) => Object.freeze({ ...line }))), packages: Object.freeze([...value.packages]) }));
    shipment.assertQuantity();
    return shipment;
  }

  add(value: Package): Shipment {
    if (this.value.state === 'cancelled' || value.value.shipment !== this.value.id) throw new Error('FULFILLMENT_SHIPMENT_STATE_INVALID');
    if (this.value.packages.some(({ value: current }) => current.id === value.value.id || current.tracking === value.value.tracking)) return this;
    return Shipment.create({ ...this.value, state: 'shipped', packages: [...this.value.packages, value], version: this.value.version + 1 });
  }

  private assertQuantity(): void {
    const limits = new Map(this.value.limits.map(({ line, quantity }) => [line, quantity]));
    const packed = new Map<string, number>();
    for (const item of this.value.packages.flatMap(({ value }) => value.lines)) packed.set(item.line, (packed.get(item.line) ?? 0) + item.quantity);
    if ([...packed].some(([line, quantity]) => !limits.has(line) || quantity > limits.get(line)!)) throw new Error('FULFILLMENT_SHIPMENT_QUANTITY_EXCEEDED');
  }
}
