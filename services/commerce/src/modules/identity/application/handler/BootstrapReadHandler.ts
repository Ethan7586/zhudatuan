import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { ExecutionContext } from '../../../../pipeline/HandlerContext';
import type { OperationReply, StatelessOperationHandler } from '../../../../pipeline/OperationHandler';
import type { IdentityStatelessAction } from '../model/IdentityAction';
import { identityReply, identityRequest } from '../model/IdentityExecution';

export class BootstrapReadHandler implements StatelessOperationHandler<'identity.bootstrap.read'> {
  readonly operation = 'identity.bootstrap.read' as const;
  readonly mode = 'read' as const;
  readonly transaction = 'none' as const;

  constructor(private readonly action: IdentityStatelessAction<'identity.bootstrap.read'>) {}

  async execute(input: OperationInputFor<'identity.bootstrap.read'>, context: ExecutionContext<'identity.bootstrap.read'>): Promise<OperationReply<OperationOutputFor<'identity.bootstrap.read'>>> {
    return identityReply<'identity.bootstrap.read'>(await this.action(identityRequest(this.operation, input, context), context));
  }
}
