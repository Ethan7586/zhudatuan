import type { ReferralOperations } from '@shop/sdk/referral';
import type { RequestContextFactory } from '../../../shared/api/RequestContext';
import type { StorefrontSession } from '../../../entity/session';

export class ReferralGateway {
  constructor(
    private readonly referral: ReferralOperations,
    private readonly context: RequestContextFactory
  ) {}
  bind(session: StorefrontSession, token: string): Promise<unknown> {
    return this.referral.bindingsCreate({ body: { token, source: 'storefront' } }, this.context(session, { write: true, idempotencyKey: `referral:${token.slice(-32)}` }));
  }
}
