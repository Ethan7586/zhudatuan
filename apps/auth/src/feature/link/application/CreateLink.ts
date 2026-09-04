import type { SessionRequest } from '../../../shared/security/ReturnTarget';
import type { LinkPort } from '../public/LinkPort';

export class CreateLink {
  constructor(private readonly port: LinkPort) {}
  execute(provider: string, session: SessionRequest, signal: AbortSignal) {
    return this.port.create(provider, session, signal);
  }
}
