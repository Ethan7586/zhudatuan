import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { IdentityAction } from '../model/IdentityAction';
import { identityReply, identityRequest } from '../model/IdentityExecution';

export class MembershipsReadHandler implements OperationHandler<'identity.memberships.read', 'read'> {
  readonly operation = 'identity.memberships.read' as const;
  readonly mode = 'read' as const;

  constructor(private readonly action: IdentityAction<'read'>) {}

  async execute(input: OperationInputFor<'identity.memberships.read'>, context: HandlerContext<'identity.memberships.read'>): Promise<OperationReply<OperationOutputFor<'identity.memberships.read'>>> {
    const request = identityRequest(this.operation, input, context);
    const result = await this.action(request, context.transaction);
    return identityReply<'identity.memberships.read'>(result);
  }
}
