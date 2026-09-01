import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { IdentityAction } from '../model/IdentityAction';
import { identityReply, identityRequest } from '../model/IdentityExecution';

export class ProvidersReadHandler implements OperationHandler<'identity.providers.read', 'read'> {
  readonly operation = 'identity.providers.read' as const;
  readonly mode = 'read' as const;

  constructor(private readonly action: IdentityAction<'read'>) {}

  async execute(input: OperationInputFor<'identity.providers.read'>, context: HandlerContext<'identity.providers.read'>): Promise<OperationReply<OperationOutputFor<'identity.providers.read'>>> {
    const request = identityRequest(this.operation, input, context);
    const result = await this.action(request, context.transaction);
    return identityReply<'identity.providers.read'>(result);
  }
}
