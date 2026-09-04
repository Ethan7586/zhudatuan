import { DomainError } from '../../../../foundation/domain/DomainError';

export type ReservationState = 'reserved' | 'committed' | 'released' | 'expired';

export interface ReservationSnapshot {
  readonly id: string;
  readonly stockitem: string;
  readonly ownerKind: 'order' | 'checkout';
  readonly owner: string;
  readonly quantity: number;
  readonly state: ReservationState;
  readonly expiresAt: string;
  readonly createdAt: string;
  readonly version: number;
}

export class Reservation {
  private constructor(private readonly value: ReservationSnapshot) {
    validate(value);
    Object.freeze(this);
  }

  static reserve(input: Omit<ReservationSnapshot, 'state' | 'version'>): Reservation {
    return new Reservation(freeze({ ...input, state: 'reserved', version: 1, expiresAt: iso(input.expiresAt), createdAt: iso(input.createdAt) }));
  }

  static restore(value: ReservationSnapshot): Reservation {
    return new Reservation(freeze(value));
  }

  commit(at: Date): Reservation {
    if (this.value.state === 'committed') return this;
    this.assertPending();
    if (at.getTime() >= Date.parse(this.value.expiresAt)) throw new DomainError('INVENTORY_RESERVATION_FINAL', { reason: 'RESERVATION_EXPIRED' });
    return this.transition('committed');
  }

  release(): Reservation {
    if (this.value.state === 'released') return this;
    this.assertPending();
    return this.transition('released');
  }

  expire(at: Date): Reservation {
    if (this.value.state === 'expired') return this;
    this.assertPending();
    if (at.getTime() < Date.parse(this.value.expiresAt)) throw new DomainError('INVENTORY_RESERVATION_FINAL', { reason: 'RESERVATION_NOT_DUE' });
    return this.transition('expired');
  }

  snapshot(): ReservationSnapshot {
    return this.value;
  }

  private assertPending(): void {
    if (this.value.state !== 'reserved') throw new DomainError('INVENTORY_RESERVATION_FINAL');
  }

  private transition(state: Exclude<ReservationState, 'reserved'>): Reservation {
    return new Reservation(freeze({ ...this.value, state, version: this.value.version + 1 }));
  }
}

function validate(value: ReservationSnapshot): void {
  if (!/^reservation:[A-Za-z0-9][A-Za-z0-9.:/-]*$/.test(value.id) || !/^stock:/.test(value.stockitem) || !value.owner) invalid();
  if (!['order', 'checkout'].includes(value.ownerKind) || !['reserved', 'committed', 'released', 'expired'].includes(value.state)) invalid();
  if (!Number.isSafeInteger(value.quantity) || value.quantity < 1 || !Number.isSafeInteger(value.version) || value.version < 1) invalid();
  if (Date.parse(value.expiresAt) <= Date.parse(value.createdAt)) invalid();
}
function iso(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) invalid();
  return date.toISOString();
}
function freeze(value: ReservationSnapshot): ReservationSnapshot {
  return Object.freeze({ ...value });
}
function invalid(): never {
  throw new DomainError('INVENTORY_QUANTITY_INVALID');
}
