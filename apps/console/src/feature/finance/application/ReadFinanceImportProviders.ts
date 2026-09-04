import { OP_CHANNEL_CONNECTIONS_READ } from '@shop/contract/ids';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { assertOperationAccess } from '../../../shared/security/OperationAccess';
import type { FinancePort } from '../public';

export class ReadFinanceImportProviders {
  constructor(private readonly port: Pick<FinancePort, 'importProviders'>) {}

  execute(context: ConsoleContext, signal?: AbortSignal) {
    assertOperationAccess(context, OP_CHANNEL_CONNECTIONS_READ);
    return this.port.importProviders(context, signal);
  }
}
