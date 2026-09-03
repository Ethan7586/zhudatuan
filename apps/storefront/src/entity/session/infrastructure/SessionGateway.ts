import type { StorefrontClient } from '../../../shared/api/Client';
import type { StorefrontSession } from '../model/Session';
import type { SessionPort } from '../public/SessionPort';

export class SessionGateway implements SessionPort {
  constructor(private readonly identity: StorefrontClient['commerce']['identity'], private readonly context: StorefrontClient['context']) {}

  end(session: StorefrontSession, idempotencyKey: string) {
    return this.identity.sessionDelete(
      { body: {} },
      this.context(session, { write: true, includeScope: false, idempotencyKey, expectedVersion: session.accessVersion })
    );
  }
}
