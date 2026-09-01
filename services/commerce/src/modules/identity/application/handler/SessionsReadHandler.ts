import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { IdentityAction } from '../model/IdentityAction';
import { identityReply, identityRequest } from '../model/IdentityExecution';

export class SessionsReadHandler implements OperationHandler<'identity.sessions.read', 'read'> {
  readonly operation = 'identity.sessions.read' as const;
  readonly mode = 'read' as const;

  constructor(private readonly action: IdentityAction<'read'>) {}

  async execute(input: OperationInputFor<'identity.sessions.read'>, context: HandlerContext<'identity.sessions.read'>): Promise<OperationReply<OperationOutputFor<'identity.sessions.read'>>> {
    const request = identityRequest(this.operation, input, context);
    const result = await this.action(request, context.transaction);
    return identityReply<'identity.sessions.read'>(result);
  }
}
