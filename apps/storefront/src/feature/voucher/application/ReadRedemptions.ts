import type { StorefrontSession } from '../../../entity/session';
import type { VoucherPort } from '../public/VoucherPort';
import type { Redemption } from '../model/Redemption';

export class ReadRedemptions {
  constructor(private readonly gateway: Pick<VoucherPort, 'redemptions'>) {}
  execute(session: StorefrontSession, signal?: AbortSignal): Promise<readonly Redemption[]> {
    return this.gateway.redemptions(session, signal);
  }
}
