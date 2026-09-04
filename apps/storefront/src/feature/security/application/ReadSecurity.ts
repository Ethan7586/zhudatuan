import type { StorefrontSession } from '../../../entity/session';
import type { SecurityPort } from '../public/SecurityPort';
import type { Security } from '../model/Security';

export class ReadSecurity {
  constructor(private readonly gateway: Pick<SecurityPort, 'read'>) {}
  execute(session: StorefrontSession, signal?: AbortSignal): Promise<Security> {
    return this.gateway.read(session, signal);
  }
}
