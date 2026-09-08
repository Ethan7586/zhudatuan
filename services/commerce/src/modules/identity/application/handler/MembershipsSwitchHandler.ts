import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import type { IdentityAction } from '../model/IdentityAction';
import { identityReply, identityRequest } from '../model/IdentityExecution';

export class MembershipsSwitchHandler implements OperationHandler<'identity.memberships.switch', 'write'> {
  readonly operation = 'identity.memberships.switch' as const;
  readonly mode = 'write' as const;

  constructor(private readonly action: IdentityAction) {}

  async execute(input: OperationInputFor<'identity.memberships.switch'>, context: WriteHandlerContext<'identity.memberships.switch'>): Promise<OperationReply<OperationOutputFor<'identity.memberships.switch'>>> {
    const request = identityRequest(this.operation, input, context);
    const result = await this.action(request, context.transaction);
    return identityReply<'identity.memberships.switch'>(result);
  }
}
