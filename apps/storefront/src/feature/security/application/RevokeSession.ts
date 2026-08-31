import type { StorefrontSession } from '../../../shared/api/Session';
import { SecurityGateway } from '../infrastructure/SecurityGateway';

export class RevokeSession {
  execute(session: StorefrontSession, target: string): Promise<readonly string[]> {
    if (!target) throw new Error('SESSION_TARGET_REQUIRED');
    return SecurityGateway.revoke(session, target, `session:${target}:revoke`);
  }
}
