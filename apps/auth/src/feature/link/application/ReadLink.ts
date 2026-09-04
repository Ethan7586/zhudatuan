import type { AuthTarget } from '@shop/config/client';
import type { LinkPort } from '../public/LinkPort';
export class ReadLink {
  constructor(private readonly port: LinkPort) {}
  execute(target: AuthTarget, signal: AbortSignal) {
    return this.port.read(target, signal);
  }
}
