import { DomainError } from '../../../../foundation/domain/DomainError';
import { TenderPolicy } from '../policy/TenderPolicy';

export interface TenderHoldValue { readonly id: string; readonly voucher: string; readonly owner: string; readonly amountMinor: number; readonly state: 'active' | 'consumed' | 'released' | 'expired'; readonly expiresAt: Date; readonly idempotency: string; readonly version: number; }
export class TenderHold {
  constructor(readonly value: TenderHoldValue) { new TenderPolicy().validate(value); }
  consume(now: Date): TenderHold { new TenderPolicy().consume(this.value, now); return this.move('consumed'); }
  release(now: Date): TenderHold { new TenderPolicy().release(this.value, now); return this.move(now >= this.value.expiresAt ? 'expired' : 'released'); }
  private move(state: TenderHoldValue['state']): TenderHold { return new TenderHold(Object.freeze({ ...this.value, state, version: this.value.version + 1 })); }
}
