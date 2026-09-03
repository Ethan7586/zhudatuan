import type { StorefrontSession } from '../../../entity/session';
import { SecurityGateway } from '../infrastructure/SecurityGateway';

export class RevokeSession {
  constructor(private readonly gateway: Pick<SecurityGateway, 'revoke'>) {}
  execute(session: StorefrontSession, target: string): Promise<readonly string[]> {
    if (!target) throw new Error('SESSION_TARGET_REQUIRED');
    return this.gateway.revoke(session, target, `session:${target}:revoke`);
  }
}
