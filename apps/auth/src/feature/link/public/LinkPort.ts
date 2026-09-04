import type { SessionRequest } from '../../../shared/security/ReturnTarget';
import type { LinkRedirect, LinkSnapshot } from '../model/Link';
export interface LinkPort {
  read(session: SessionRequest, signal: AbortSignal): Promise<LinkSnapshot>;
  create(provider: string, session: SessionRequest, signal: AbortSignal): Promise<LinkRedirect>;
  revoke(link: string, session: SessionRequest, signal: AbortSignal): Promise<void>;
}
