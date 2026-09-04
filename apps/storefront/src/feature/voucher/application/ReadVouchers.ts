import type { StorefrontSession } from '../../../entity/session';
import type { VoucherPort } from '../public/VoucherPort';
import type { Voucher } from '../model/Voucher';

export class ReadVouchers {
  constructor(private readonly gateway: Pick<VoucherPort, 'vouchers'>) {}
  execute(session: StorefrontSession, signal?: AbortSignal): Promise<readonly Voucher[]> {
    return this.gateway.vouchers(session, signal);
  }
}
