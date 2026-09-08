import { DomainError } from '../../../../platform/error/DomainError';

export class VoucherValue {
  constructor(
    readonly minor: number,
    readonly currency = 'CNY'
  ) {
    if (!Number.isSafeInteger(minor) || minor < 0 || currency !== 'CNY') throw new DomainError('VALIDATION_FAILED', { field: 'value' });
  }
  subtract(amount: number): VoucherValue {
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount > this.minor) throw new DomainError('VOUCHER_NOT_USABLE');
    return new VoucherValue(this.minor - amount, this.currency);
  }
}
