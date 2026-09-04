import type { AuthTarget } from '@shop/config/client';
import type { AuthRequest } from '../../../shared/security/ReturnTarget';
import type { FederationPort } from '../public/FederationPort';

export class StartFederation {
  constructor(private readonly port: FederationPort) {}
  execute(provider: string, target: AuthTarget, returns: Omit<AuthRequest, 'target'>, signal?: AbortSignal) {
    return this.port.start(provider, target, returns, signal);
  }
}
