import type { IdentityOperations } from '@shop/sdk/identity';
import type { RequestContextFactory } from '../../../shared/api/RequestContext';
import type { StorefrontSession } from '../../../entity/session';

export class StepupGateway {
  constructor(
    private readonly identity: IdentityOperations,
    private readonly context: RequestContextFactory
  ) {}
  async phoneMasked(session: StorefrontSession, signal?: AbortSignal) {
    const value = await this.identity.sessionRead({}, this.context(session, { signal, includeScope: false }));
    return value.security.phoneMasked;
  }
  start(session: StorefrontSession) {
    return this.identity.stepupStart({ body: {} }, this.context(session, { write: true, includeScope: false, idempotencyKey: crypto.randomUUID() }));
  }
  complete(session: StorefrontSession, challenge: string, code: string) {
    return this.identity.stepupComplete({ body: { challenge, code } }, this.context(session, { write: true, includeScope: false, idempotencyKey: crypto.randomUUID() }));
  }
}
