import type { SessionRequest } from '../../../shared/security/ReturnTarget';
import type { LinkPort } from '../public/LinkPort';
export class ReadLink {
  constructor(private readonly port: LinkPort) {}
  execute(session: SessionRequest, signal: AbortSignal) {
    return this.port.read(session, signal);
  }
}
