import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { IdentityAction } from '../model/IdentityAction';
import { identityReply, identityRequest } from '../model/IdentityExecution';

export class InvitationsCreateHandler implements OperationHandler<'identity.invitations.create', 'write'> {
  readonly operation = 'identity.invitations.create' as const;
  readonly mode = 'write' as const;

  constructor(private readonly action: IdentityAction) {}

  async execute(input: OperationInputFor<'identity.invitations.create'>, context: WriteHandlerContext<'identity.invitations.create'>): Promise<OperationReply<OperationOutputFor<'identity.invitations.create'>>> {
    const request = identityRequest(this.operation, input, context);
    const result = await this.action(request, context.transaction);
    return identityReply<'identity.invitations.create'>(result);
  }
}
