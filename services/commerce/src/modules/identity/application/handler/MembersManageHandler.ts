import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { IdentityAction } from '../model/IdentityAction';
import { identityReply, identityRequest } from '../model/IdentityExecution';

export class MembersManageHandler implements OperationHandler<'identity.members.manage', 'write'> {
  readonly operation = 'identity.members.manage' as const;
  readonly mode = 'write' as const;

  constructor(private readonly action: IdentityAction) {}

  async execute(input: OperationInputFor<'identity.members.manage'>, context: WriteHandlerContext<'identity.members.manage'>): Promise<OperationReply<OperationOutputFor<'identity.members.manage'>>> {
    const request = identityRequest(this.operation, input, context);
    const result = await this.action(request, context.transaction);
    return identityReply<'identity.members.manage'>(result);
  }
}
