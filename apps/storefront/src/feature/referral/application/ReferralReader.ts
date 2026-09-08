import type { StorefrontSession } from '../../../entity/session';
import type { ReferralPort } from '../public/ReferralPort';

export class ReferralReader {
  constructor(private readonly gateway: Pick<ReferralPort, 'earnings' | 'withdrawals' | 'link'>) {}
  earnings(session: StorefrontSession, cursor?: string, signal?: AbortSignal) {
    return this.gateway.earnings(session, cursor, signal);
  }
  withdrawals(session: StorefrontSession, cursor?: string, signal?: AbortSignal) {
    return this.gateway.withdrawals(session, cursor, signal);
  }
  link(session: StorefrontSession, productId?: string, signal?: AbortSignal) {
    return this.gateway.link(session, productId, signal);
  }
}
