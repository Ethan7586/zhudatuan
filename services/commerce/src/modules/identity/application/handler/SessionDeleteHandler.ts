import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import type { IdentityAction } from '../model/IdentityAction';
import { identityReply, identityRequest } from '../model/IdentityExecution';

export class SessionDeleteHandler implements OperationHandler<'identity.session.delete', 'write'> {
  readonly operation = 'identity.session.delete' as const;
  readonly mode = 'write' as const;

  constructor(private readonly action: IdentityAction) {}

  async execute(input: OperationInputFor<'identity.session.delete'>, context: WriteHandlerContext<'identity.session.delete'>): Promise<OperationReply<OperationOutputFor<'identity.session.delete'>>> {
    const request = identityRequest(this.operation, input, context);
    const result = await this.action(request, context.transaction);
    return identityReply<'identity.session.delete'>(result);
  }
}
