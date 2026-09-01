import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { IdentityAction } from '../model/IdentityAction';
import { identityReply, identityRequest } from '../model/IdentityExecution';

export class InvitationsRevokeHandler implements OperationHandler<'identity.invitations.revoke', 'write'> {
  readonly operation = 'identity.invitations.revoke' as const;
  readonly mode = 'write' as const;

  constructor(private readonly action: IdentityAction) {}

  async execute(input: OperationInputFor<'identity.invitations.revoke'>, context: WriteHandlerContext<'identity.invitations.revoke'>): Promise<OperationReply<OperationOutputFor<'identity.invitations.revoke'>>> {
    const request = identityRequest(this.operation, input, context);
    const result = await this.action(request, context.transaction);
    return identityReply<'identity.invitations.revoke'>(result);
  }
}
