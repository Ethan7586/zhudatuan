import { storefrontClient } from '../../../shared/api/Client';
import type { StorefrontSession } from '../../../shared/api/Session';

export const ReferralGateway = Object.freeze({
  bind(session: StorefrontSession, token: string): Promise<unknown> {
    return storefrontClient.commerce.referral.bindingsCreate({ body: { token, source: 'storefront' } }, storefrontClient.context(session, { write: true, idempotencyKey: `referral:${token.slice(-32)}` }));
  },
});
