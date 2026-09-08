import type { OperationInputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler } from '../../../../pipeline/OperationHandler';
import type { GrantRepository } from '../port/GrantRepository';
export class GrantsControlHandler implements OperationHandler<'benefit.grants.control', 'write'> {
  readonly operation = 'benefit.grants.control' as const;
  readonly mode = 'write' as const;
  constructor(private readonly grants: GrantRepository) {}
  async execute(input: OperationInputFor<'benefit.grants.control'>, context: WriteHandlerContext<'benefit.grants.control'>) {
    const result = await this.grants.controlGrant(context.transaction, input, context);
    return result;
  }
}
