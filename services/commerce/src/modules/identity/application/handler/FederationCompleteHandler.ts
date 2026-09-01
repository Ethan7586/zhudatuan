import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { IdentityAction } from '../model/IdentityAction';
import { identityReply, identityRequest } from '../model/IdentityExecution';

export class FederationCompleteHandler implements OperationHandler<'identity.federations.complete', 'write'> {
  readonly operation = 'identity.federations.complete' as const;
  readonly mode = 'write' as const;

  constructor(private readonly action: IdentityAction) {}

  async execute(input: OperationInputFor<'identity.federations.complete'>, context: WriteHandlerContext<'identity.federations.complete'>): Promise<OperationReply<OperationOutputFor<'identity.federations.complete'>>> {
    const request = identityRequest(this.operation, input, context);
    const result = await this.action(request, context.transaction);
    return identityReply<'identity.federations.complete'>(result);
  }
}
