import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { IdentityAction } from '../model/IdentityAction';
import { identityReply, identityRequest } from '../model/IdentityExecution';

export class BootstrapReadHandler implements OperationHandler<'identity.bootstrap.read', 'read'> {
  readonly operation = 'identity.bootstrap.read' as const;
  readonly mode = 'read' as const;

  constructor(private readonly action: IdentityAction<'read'>) {}

  async execute(input: OperationInputFor<'identity.bootstrap.read'>, context: HandlerContext<'identity.bootstrap.read'>): Promise<OperationReply<OperationOutputFor<'identity.bootstrap.read'>>> {
    return identityReply<'identity.bootstrap.read'>(await this.action(identityRequest(this.operation, input, context), context.transaction));
  }
}
