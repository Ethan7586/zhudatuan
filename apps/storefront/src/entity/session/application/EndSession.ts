import type { SessionPort } from '../public/SessionPort';
import type { StorefrontSession } from '../model/Session';

export class EndSession {
  constructor(private readonly port: SessionPort) {}
  execute(session: StorefrontSession) { return this.port.end(session, crypto.randomUUID()); }
}
