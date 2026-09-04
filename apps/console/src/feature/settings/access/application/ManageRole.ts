import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import type { AccessChange } from '../model/Access';
import type { AccessPort } from '../public';
import { executeAccess } from './ExecuteAccess';

export class ManageRole {
  constructor(private readonly port: Pick<AccessPort, 'execute'>) {}
  execute(context: ConsoleContext, change: Extract<AccessChange, { kind: 'role' }>, proof: string, identity: string, signal?: AbortSignal) {
    return executeAccess(this.port, context, change, proof, identity, signal);
  }
}
