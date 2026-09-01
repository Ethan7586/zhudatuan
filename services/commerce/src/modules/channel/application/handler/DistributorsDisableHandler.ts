import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { DistributorRepository } from '../port/DistributorRepository';

export class DistributorsDisableHandler implements OperationHandler<'channel.distributors.disable', 'write'> {
  readonly operation = 'channel.distributors.disable' as const;
  readonly mode = 'write' as const;
  constructor(private readonly distributors: DistributorRepository) {}
  async execute(input: OperationInputFor<'channel.distributors.disable'>, context: WriteHandlerContext<'channel.distributors.disable'>): Promise<OperationReply<OperationOutputFor<'channel.distributors.disable'>>> {
    const access = requireSession(context.security);
    const result = await this.distributors.disable(context.transaction, input.path.distributorid, access.scope.id, context.expectedVersion ?? null);
    return { status: 200, body: result as OperationOutputFor<'channel.distributors.disable'> };
  }
}
