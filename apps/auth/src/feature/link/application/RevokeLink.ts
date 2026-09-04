import type { SessionRequest } from '../../../shared/security/ReturnTarget';
import type { LinkPort } from '../public/LinkPort';

export class RevokeLink {
  constructor(private readonly port: LinkPort) {}
  execute(link: string, session: SessionRequest, signal: AbortSignal) {
    return this.port.revoke(link, session, signal);
  }
}
