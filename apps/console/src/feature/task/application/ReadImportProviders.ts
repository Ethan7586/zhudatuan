import { OP_CHANNEL_CONNECTIONS_READ } from '@shop/contract/ids';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { assertOperationAccess } from '../../../shared/security/OperationAccess';
import type { TaskPort } from '../public';

export class ReadImportProviders {
  constructor(private readonly port: Pick<TaskPort, 'providers'>) {}

  execute(context: ConsoleContext, signal?: AbortSignal) {
    assertOperationAccess(context, OP_CHANNEL_CONNECTIONS_READ);
    return this.port.providers(context, signal);
  }
}
