import type { SessionRequest } from '../../../shared/security/ReturnTarget';
import type { ReadProviders } from '../application/ReadProviders';
import type { StartFederation } from '../application/StartFederation';

export class FederationViewModel {
  constructor(
    private readonly providers: ReadProviders,
    private readonly federation: StartFederation
  ) {}
  read(session: SessionRequest, signal: AbortSignal) {
    return this.providers.execute(session, signal);
  }
  start(provider: string, session: SessionRequest, signal: AbortSignal) {
    return this.federation.execute(provider, session, signal);
  }
}
