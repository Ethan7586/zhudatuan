import { storefrontClient } from '../../../shared/api/Client';
import type { StorefrontSession } from '../../../shared/api/Session';

export const PaymentGateway = Object.freeze({
  read(session: StorefrontSession, paymentId: string, signal?: AbortSignal) {
    return storefrontClient.commerce.payment.intentsRead({ path: { paymentid: paymentId } }, storefrontClient.context(session, { signal }));
  },
});
