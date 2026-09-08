import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import type { ProviderOperationRepository } from '../port/ProviderOperationRepository';

export class OperationsReplayHandler implements OperationHandler<'channel.operations.replay', 'write'> {
  readonly operation = 'channel.operations.replay' as const;
  readonly mode = 'write' as const;
  constructor(private readonly operations: ProviderOperationRepository) {}
  async execute(input: OperationInputFor<'channel.operations.replay'>, context: WriteHandlerContext<'channel.operations.replay'>): Promise<OperationReply<OperationOutputFor<'channel.operations.replay'>>> {
    const access = requireSession(context.security);
    const result = await this.operations.replay(context.transaction, input.path.operationid, access.scope.id);
    return { status: 202, body: result as OperationOutputFor<'channel.operations.replay'> };
  }
}
