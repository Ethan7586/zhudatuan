import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { IdentityAction } from '../model/IdentityAction';
import { identityReply, identityRequest } from '../model/IdentityExecution';

export class SessionsRevokeHandler implements OperationHandler<'identity.sessions.revoke', 'write'> {
  readonly operation = 'identity.sessions.revoke' as const;
  readonly mode = 'write' as const;

  constructor(private readonly action: IdentityAction) {}

  async execute(input: OperationInputFor<'identity.sessions.revoke'>, context: WriteHandlerContext<'identity.sessions.revoke'>): Promise<OperationReply<OperationOutputFor<'identity.sessions.revoke'>>> {
    const request = identityRequest(this.operation, input, context);
    const result = await this.action(request, context.transaction);
    return identityReply<'identity.sessions.revoke'>(result);
  }
}
