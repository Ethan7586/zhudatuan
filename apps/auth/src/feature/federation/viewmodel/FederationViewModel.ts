import type { AuthTarget } from '@shop/config/client';
import type { AuthRequest } from '../../../shared/security/ReturnTarget';
import type { ReadProviders } from '../application/ReadProviders';
import type { StartFederation } from '../application/StartFederation';

export class FederationViewModel {
  constructor(private readonly providers: ReadProviders, private readonly federation: StartFederation) {}
  read(target: AuthTarget, signal: AbortSignal) { return this.providers.execute(target, signal); }
  start(provider: string, target: AuthTarget, returns: Omit<AuthRequest, 'target'>, signal: AbortSignal) { return this.federation.execute(provider, target, returns, signal); }
}
