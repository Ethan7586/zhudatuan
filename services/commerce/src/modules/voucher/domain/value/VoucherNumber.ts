import { DomainError } from '../../../../foundation/domain/DomainError';
import { voucherNumber } from '@shop/contract/voucher';

export class VoucherNumber {
  readonly value: string;
  constructor(value: string) {
    const normalized = voucherNumber(value);
    if (normalized === null) throw new DomainError('VALIDATION_FAILED', { field: 'number' });
    this.value = normalized;
  }
  masked(): string { return `${this.value.slice(0, 4)}${'*'.repeat(Math.max(4, this.value.length - 8))}${this.value.slice(-4)}`; }
}
