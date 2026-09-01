import { storefrontClient } from '../../../shared/api/Client';
import type { StorefrontSession } from '../../../shared/api/Session';

export const StepupGateway = Object.freeze({
  async phoneMasked(session: StorefrontSession, signal?: AbortSignal) {
    const value = await storefrontClient.commerce.identity.sessionRead({}, storefrontClient.context(session, { signal, includeScope: false }));
    return value.security.phoneMasked;
  },
  start(session: StorefrontSession) {
    return storefrontClient.commerce.identity.stepupStart({ body: {} }, storefrontClient.context(session, { write: true, includeScope: false, idempotencyKey: crypto.randomUUID() }));
  },
  complete(session: StorefrontSession, challenge: string, code: string) {
    return storefrontClient.commerce.identity.stepupComplete({ body: { challenge, code } }, storefrontClient.context(session, { write: true, includeScope: false, idempotencyKey: crypto.randomUUID() }));
  },
});
