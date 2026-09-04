import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import type { AccessChange } from '../model/Access';
import type { AccessPort } from '../public';
import { executeAccess } from './ExecuteAccess';

export class TransferOwner {
  constructor(private readonly port: Pick<AccessPort, 'execute'>) {}
  execute(context: ConsoleContext, change: Extract<AccessChange, { kind: 'owner' }>, proof: string, identity: string, signal?: AbortSignal) {
    if (change.membership.id === change.target.id) throw new Error('OWNER_TRANSFER_REQUIRED');
    if (change.target.client !== 'console' || change.target.status !== 'active') throw new Error('OWNER_TRANSFER_REQUIRED');
    return executeAccess(this.port, context, change, proof, identity, signal);
  }
}
