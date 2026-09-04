import { OP_IDENTITY_PROVIDERS_CENTER_READ } from '@shop/contract/ids';
import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import { assertOperationAccess } from '../../../../shared/security/OperationAccess';
import type { FederationPort } from '../public';
export class ReadFederations {
  constructor(private readonly port: Pick<FederationPort, 'read'>) {}
  execute(context: ConsoleContext, signal?: AbortSignal) {
    assertOperationAccess(context, OP_IDENTITY_PROVIDERS_CENTER_READ);
    return this.port.read(context, signal);
  }
}
