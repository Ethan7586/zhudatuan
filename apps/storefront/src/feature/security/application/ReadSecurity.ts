import type { StorefrontSession } from '../../../shared/api/Session';
import { SecurityGateway } from '../infrastructure/SecurityGateway';
import type { Security } from '../model/Security';

export function readSecurity(session: StorefrontSession, signal?: AbortSignal): Promise<Security> {
  return SecurityGateway.read(session, signal);
}
