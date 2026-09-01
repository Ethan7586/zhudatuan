import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { IdentityAction } from '../model/IdentityAction';
import { identityReply, identityRequest } from '../model/IdentityExecution';

export class LinksReadHandler implements OperationHandler<'identity.links.read', 'read'> {
  readonly operation = 'identity.links.read' as const;
  readonly mode = 'read' as const;

  constructor(private readonly action: IdentityAction<'read'>) {}

  async execute(input: OperationInputFor<'identity.links.read'>, context: HandlerContext<'identity.links.read'>): Promise<OperationReply<OperationOutputFor<'identity.links.read'>>> {
    const request = identityRequest(this.operation, input, context);
    const result = await this.action(request, context.transaction);
    return identityReply<'identity.links.read'>(result);
  }
}
