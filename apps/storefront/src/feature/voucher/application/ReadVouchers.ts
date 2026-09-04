import type { StorefrontSession } from '../../../entity/session';
import type { VoucherPort } from '../public/VoucherPort';
import type { Voucher } from '../model/Voucher';
import type { VoucherPage } from '../model/VoucherPage';

export class ReadVouchers {
  constructor(private readonly gateway: Pick<VoucherPort, 'list'>) {}
  execute(session: StorefrontSession, cursor: string | null, signal?: AbortSignal): Promise<VoucherPage<Voucher>> {
    return this.gateway.list(session, cursor, signal);
  }
}
