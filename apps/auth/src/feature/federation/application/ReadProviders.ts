import type { AuthTarget } from '@shop/config/client';
import type { FederationPort } from '../public/FederationPort';

export class ReadProviders {
  constructor(private readonly port: FederationPort) {}
  execute(target: AuthTarget, signal?: AbortSignal) {
    return this.port.read(target, signal);
  }
}
