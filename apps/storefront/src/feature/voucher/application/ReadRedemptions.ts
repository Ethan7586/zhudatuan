import type { StorefrontSession } from '../../../entity/session';
import { VoucherGateway } from '../infrastructure/VoucherGateway';
import type { Redemption } from '../model/Redemption';

export class ReadRedemptions {
  constructor(private readonly gateway: Pick<VoucherGateway, 'redemptions'>) {}
  execute(session: StorefrontSession, signal?: AbortSignal): Promise<readonly Redemption[]> { return this.gateway.redemptions(session, signal); }
}
