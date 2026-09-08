import { DomainError } from '../../../../platform/error/DomainError';
import type { VoucherValue } from '../model/Voucher';
export class BindingPolicy {
  bind(voucher: VoucherValue, holder: string): void {
    if (!holder || voucher.holder !== null || !['available', 'allocated'].includes(voucher.state)) throw new DomainError('VOUCHER_STATE_INVALID');
  }
  unbind(voucher: VoucherValue): void {
    if (voucher.holder === null || !['bound', 'active', 'disabled'].includes(voucher.state) || voucher.remainingMinor !== voucher.initialMinor) throw new DomainError('VOUCHER_STATE_INVALID');
  }
}
