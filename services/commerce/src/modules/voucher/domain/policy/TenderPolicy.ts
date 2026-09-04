import { DomainError } from '../../../../foundation/domain/DomainError';
import type { TenderHoldValue } from '../model/TenderHold';
export class TenderPolicy {
  validate(value: TenderHoldValue): void {
    if (!value.id || !value.voucher || !value.owner || !value.idempotency || !Number.isSafeInteger(value.amountMinor) || value.amountMinor <= 0 || !Number.isFinite(value.expiresAt.getTime()) || value.version < 0) throw new DomainError('VOUCHER_HOLD_CONFLICT');
  }
  consume(value: TenderHoldValue, now: Date): void {
    if (value.state !== 'active') throw new DomainError('VOUCHER_HOLD_CONFLICT');
    if (now >= value.expiresAt) throw new DomainError('VOUCHER_HOLD_EXPIRED');
  }
  release(value: TenderHoldValue, _now: Date): void { if (value.state !== 'active') throw new DomainError('VOUCHER_HOLD_CONFLICT'); }
}
