import type { OperationInputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler } from '../../../../pipeline/OperationHandler';
import type { GrantRepository } from '../port/GrantRepository';
export class GrantsDecideHandler implements OperationHandler<'benefit.grants.decide', 'write'> {
  readonly operation = 'benefit.grants.decide' as const;
  readonly mode = 'write' as const;
  constructor(private readonly grants: GrantRepository) {}
  async execute(input: OperationInputFor<'benefit.grants.decide'>, context: WriteHandlerContext<'benefit.grants.decide'>) {
    const result = await this.grants.decideGrant(context.transaction, input, context);
    return result;
  }
}
