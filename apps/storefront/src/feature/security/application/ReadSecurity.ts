import type { StorefrontSession } from '../../../entity/session';
import { SecurityGateway } from '../infrastructure/SecurityGateway';
import type { Security } from '../model/Security';

export class ReadSecurity {
  constructor(private readonly gateway: Pick<SecurityGateway, 'read'>) {}
  execute(session: StorefrontSession, signal?: AbortSignal): Promise<Security> { return this.gateway.read(session, signal); }
}
