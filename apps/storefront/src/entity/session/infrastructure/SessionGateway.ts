import type { IdentityOperations } from '@shop/sdk/identity';
import type { RequestContextFactory } from '../../../shared/api/RequestContext';
import type { StorefrontSession } from '../model/Session';
import type { SessionPort } from '../public/SessionPort';

export class SessionGateway implements SessionPort {
  constructor(
    private readonly identity: IdentityOperations,
    private readonly context: RequestContextFactory
  ) {}

  end(session: StorefrontSession, idempotencyKey: string) {
    return this.identity.sessionDelete({ body: {} }, this.context(session, { write: true, includeScope: false, idempotencyKey, expectedVersion: session.accessVersion }));
  }
}
