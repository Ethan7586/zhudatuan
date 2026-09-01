import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { IdentityAction } from '../model/IdentityAction';
import { identityReply, identityRequest } from '../model/IdentityExecution';

export class ProvidersManageHandler implements OperationHandler<'identity.providers.manage', 'write'> {
  readonly operation = 'identity.providers.manage' as const;
  readonly mode = 'write' as const;

  constructor(private readonly action: IdentityAction) {}

  async execute(input: OperationInputFor<'identity.providers.manage'>, context: WriteHandlerContext<'identity.providers.manage'>): Promise<OperationReply<OperationOutputFor<'identity.providers.manage'>>> {
    const request = identityRequest(this.operation, input, context);
    const result = await this.action(request, context.transaction);
    return identityReply<'identity.providers.manage'>(result);
  }
}
