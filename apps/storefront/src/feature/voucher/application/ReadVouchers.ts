import type { StorefrontSession } from '../../../shared/api/Session';
import { VoucherGateway } from '../infrastructure/VoucherGateway';
import type { Voucher } from '../model/Voucher';

export function readVouchers(session: StorefrontSession, signal?: AbortSignal): Promise<readonly Voucher[]> {
  return VoucherGateway.vouchers(session, signal);
}
