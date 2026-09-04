import { OP_ORGANIZATION_DIRECTORIES_SYNC } from '@shop/contract/ids';
import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import { assertOperationAccess } from '../../../../shared/security/OperationAccess';
import type { DirectoryCommand } from '../model/SyncRun';
import type { DirectoryPort } from '../public';

export class CancelSync {
  constructor(private readonly port: DirectoryPort) {}
  execute(context: ConsoleContext, command: Extract<DirectoryCommand, { action: 'cancel' }>) {
    assertOperationAccess(context, OP_ORGANIZATION_DIRECTORIES_SYNC, command.proof);
    return this.port.synchronize(context, command);
  }
}
