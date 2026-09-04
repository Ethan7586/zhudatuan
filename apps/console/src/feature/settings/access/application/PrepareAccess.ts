import type { AccessChange } from '../model/Access';
import type { AccessPort } from '../public';

export class PrepareAccess {
  constructor(private readonly port: Pick<AccessPort, 'prepare'>) {}
  execute(change: AccessChange, makerMembership: string, scope: string) {
    if (!makerMembership || !scope) throw new Error('ACTION_REQUEST_INVALID');
    return this.port.prepare(change, makerMembership, scope);
  }
}
