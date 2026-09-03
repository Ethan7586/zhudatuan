import type { StorefrontSession } from '../../../entity/session';
import { VoucherGateway } from '../infrastructure/VoucherGateway';
import type { Voucher } from '../model/Voucher';

export class ReadVouchers {
  constructor(private readonly gateway: Pick<VoucherGateway, 'vouchers'>) {}
  execute(session: StorefrontSession, signal?: AbortSignal): Promise<readonly Voucher[]> { return this.gateway.vouchers(session, signal); }
}
