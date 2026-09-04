import type { StorefrontSession } from '../../../entity/session';
import type { VoucherActivity } from '../model/VoucherActivity';
import type { VoucherPort } from '../public/VoucherPort';
import type { VoucherPage } from '../model/VoucherPage';

export class ReadVoucherTimeline {
  constructor(private readonly gateway: Pick<VoucherPort, 'timeline'>) {}
  execute(session: StorefrontSession, voucher: string, cursor: string | null, signal?: AbortSignal): Promise<VoucherPage<VoucherActivity>> {
    return this.gateway.timeline(session, voucher, cursor, signal);
  }
}
