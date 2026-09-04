import { DomainError } from '../../../../foundation/domain/DomainError';
import { Aggregate } from '../../../../foundation/domain/Aggregate';

export type ReservationState = 'active' | 'committed' | 'released' | 'expired';

export class Reservation extends Aggregate {
  constructor(id: string, readonly quantity: number, private stateValue: ReservationState = 'active') {
    super(id);
    if (!Number.isSafeInteger(quantity) || quantity < 1) throw new DomainError('INVENTORY_QUANTITY_INVALID');
  }
  get state(): ReservationState { return this.stateValue; }

  commit(): void { this.transition('committed'); }
  release(): void { this.transition('released'); }
  expire(): void { this.transition('expired'); }
  private transition(next: Exclude<ReservationState, 'active'>): void {
    if (this.stateValue !== 'active') throw new DomainError('INVENTORY_RESERVATION_FINAL');
    this.stateValue = next;
  }
}

export function available(onhand: number, activeReserved: number, safety: number): number {
  if (![onhand, activeReserved, safety].every((value) => Number.isSafeInteger(value) && value >= 0)) throw new DomainError('INVENTORY_BALANCE_INVALID');
  return Math.max(0, onhand - activeReserved - safety);
}
