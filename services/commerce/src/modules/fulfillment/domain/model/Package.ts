import { TrackingEvent, type TrackingStatus } from './TrackingEvent';

export interface PackageLine {
  readonly line: string;
  readonly quantity: number;
}
export interface PackageSnapshot {
  readonly id: string;
  readonly shipment: string;
  readonly carrier: string | null;
  readonly tracking: string;
  readonly providerReference: string | null;
  readonly state: TrackingStatus;
  readonly lines: readonly PackageLine[];
  readonly events: readonly TrackingEvent[];
  readonly version: number;
}

export class Package {
  private constructor(readonly value: Readonly<PackageSnapshot>) {}

  static create(value: Omit<PackageSnapshot, 'events'> & { readonly events?: readonly TrackingEvent[] }): Package {
    if (!value.id || !value.shipment || !value.tracking.trim() || !Number.isSafeInteger(value.version) || value.version < 0) throw new Error('FULFILLMENT_PACKAGE_INVALID');
    if (value.lines.length === 0 || new Set(value.lines.map(({ line }) => line)).size !== value.lines.length) throw new Error('FULFILLMENT_PACKAGE_LINES_INVALID');
    if (value.lines.some(({ line, quantity }) => !line || !Number.isSafeInteger(quantity) || quantity <= 0)) throw new Error('FULFILLMENT_PACKAGE_LINES_INVALID');
    const events = [...(value.events ?? [])].sort((left, right) => left.value.occurredAt.localeCompare(right.value.occurredAt) || left.value.id.localeCompare(right.value.id));
    return new Package(Object.freeze({ ...value, carrier: value.carrier?.trim() || null, lines: Object.freeze(value.lines.map((line) => Object.freeze({ ...line }))), events: Object.freeze(events) }));
  }

  observe(event: TrackingEvent): Package {
    if (event.value.package !== this.value.id) throw new Error('TRACKING_PACKAGE_MISMATCH');
    if (this.value.events.some(({ value }) => value.external === event.value.external)) return this;
    const state = event.advances(this.value.state) ? event.value.state : this.value.state;
    return Package.create({ ...this.value, state, events: [...this.value.events, event], version: this.value.version + 1 });
  }
}
