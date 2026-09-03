import type { AuthTarget } from '@shop/config/client';
import type { AuthRequest } from '../../../shared/security/ReturnTarget';
import type { BootstrapPort } from '../public/BootstrapPort';

export class ReadBootstrap {
  constructor(private readonly port: BootstrapPort) {}
  execute(target: AuthTarget, returns: Omit<AuthRequest, 'target'>, signal?: AbortSignal) {
    return this.port.read(target, returns, signal);
  }
}
