import type { StorefrontSession } from '../../../entity/session';
import type { Voucher } from '../model/Voucher';
import type { VoucherPort } from '../public/VoucherPort';

export class ReadVoucherDetail {
  constructor(private readonly gateway: Pick<VoucherPort, 'detail'>) {}
  execute(session: StorefrontSession, voucher: string, signal?: AbortSignal): Promise<Voucher> {
    return this.gateway.detail(session, voucher, signal);
  }
}
