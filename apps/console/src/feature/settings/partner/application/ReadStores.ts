import { OP_ORGANIZATION_STORES_READ } from '@shop/contract/ids';
import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import { assertOperationAccess } from '../../../../shared/security/OperationAccess';
import type { PartnerPort } from '../public';

export class ReadStores {
  constructor(private readonly port: Pick<PartnerPort, 'readStores'>) {}
  execute(context: ConsoleContext, cursor?: string, signal?: AbortSignal) {
    assertOperationAccess(context, OP_ORGANIZATION_STORES_READ);
    return this.port.readStores(context, cursor, signal);
  }
}
