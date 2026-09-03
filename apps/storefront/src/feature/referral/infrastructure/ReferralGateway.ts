import type { StorefrontClient } from '../../../shared/api/Client';
import type { StorefrontSession } from '../../../entity/session';

export class ReferralGateway {
  constructor(private readonly referral: StorefrontClient['commerce']['referral'], private readonly context: StorefrontClient['context']) {}
  bind(session: StorefrontSession, token: string): Promise<unknown> {
    return this.referral.bindingsCreate({ body: { token, source: 'storefront' } }, this.context(session, { write: true, idempotencyKey: `referral:${token.slice(-32)}` }));
  }
}
