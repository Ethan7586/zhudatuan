import type { SessionRequest } from '../../../shared/security/ReturnTarget';
import type { BootstrapPort } from '../public/BootstrapPort';

export class ReadBootstrap {
  constructor(private readonly port: BootstrapPort) {}
  execute(request: SessionRequest, signal?: AbortSignal) {
    return this.port.read(request, signal);
  }
}
