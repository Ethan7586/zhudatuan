import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { IdentityAction } from '../model/IdentityAction';
import { identityReply, identityRequest } from '../model/IdentityExecution';

export class InvitationsReadHandler implements OperationHandler<'identity.invitations.read', 'read'> {
  readonly operation = 'identity.invitations.read' as const;
  readonly mode = 'read' as const;

  constructor(private readonly action: IdentityAction<'read'>) {}

  async execute(input: OperationInputFor<'identity.invitations.read'>, context: HandlerContext<'identity.invitations.read'>): Promise<OperationReply<OperationOutputFor<'identity.invitations.read'>>> {
    const request = identityRequest(this.operation, input, context);
    const result = await this.action(request, context.transaction);
    return identityReply<'identity.invitations.read'>(result);
  }
}
