import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { IdentityAction } from '../model/IdentityAction';
import { identityReply, identityRequest } from '../model/IdentityExecution';

export class LinksRevokeHandler implements OperationHandler<'identity.links.revoke', 'write'> {
  readonly operation = 'identity.links.revoke' as const;
  readonly mode = 'write' as const;

  constructor(private readonly action: IdentityAction) {}

  async execute(input: OperationInputFor<'identity.links.revoke'>, context: WriteHandlerContext<'identity.links.revoke'>): Promise<OperationReply<OperationOutputFor<'identity.links.revoke'>>> {
    const request = identityRequest(this.operation, input, context);
    const result = await this.action(request, context.transaction);
    return identityReply<'identity.links.revoke'>(result);
  }
}
