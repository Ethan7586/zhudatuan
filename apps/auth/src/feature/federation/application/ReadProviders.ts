import type { SessionRequest } from '../../../shared/security/ReturnTarget';
import type { FederationPort } from '../public/FederationPort';

export class ReadProviders {
  constructor(private readonly port: FederationPort) {}
  execute(session: SessionRequest, signal?: AbortSignal) {
    return this.port.read(session, signal);
  }
}
