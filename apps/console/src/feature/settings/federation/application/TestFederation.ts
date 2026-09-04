import { OP_IDENTITY_PROVIDERS_TEST } from '@shop/contract/ids';
import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import { assertOperationAccess } from '../../../../shared/security/OperationAccess';
import type { FederationPort } from '../public';
export class TestFederation {
  constructor(private readonly port: Pick<FederationPort, 'test'>) {}
  execute(context: ConsoleContext, provider: string, identity: string, signal?: AbortSignal) {
    assertOperationAccess(context, OP_IDENTITY_PROVIDERS_TEST);
    return this.port.test(context, provider, identity, signal);
  }
}
