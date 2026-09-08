import type { OperationInputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler } from '../../../../pipeline/OperationHandler';
import type { GrantRepository } from '../port/GrantRepository';
export class GrantsCreateHandler implements OperationHandler<'benefit.grants.create', 'write'> {
  readonly operation = 'benefit.grants.create' as const;
  readonly mode = 'write' as const;
  constructor(private readonly grants: GrantRepository) {}
  async execute(input: OperationInputFor<'benefit.grants.create'>, context: WriteHandlerContext<'benefit.grants.create'>) {
    const result = await this.grants.createGrant(context.transaction, input, context);
    return result;
  }
}
