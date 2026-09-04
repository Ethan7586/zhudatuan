import type { SessionRequest } from '../../../shared/security/ReturnTarget';
import type { FederationPort } from '../public/FederationPort';

export class StartFederation {
  constructor(private readonly port: FederationPort) {}
  execute(provider: string, session: SessionRequest, signal?: AbortSignal) {
    return this.port.start(provider, session, signal);
  }
}
