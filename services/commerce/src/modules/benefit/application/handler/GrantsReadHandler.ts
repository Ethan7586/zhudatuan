import type { OperationInputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler } from '../../../../pipeline/OperationHandler';
import type { GrantRepository } from '../port/GrantRepository';
export class GrantsReadHandler implements OperationHandler<'benefit.grants.read', 'read'> {
  readonly operation = 'benefit.grants.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly grants: GrantRepository) {}
  async execute(input: OperationInputFor<'benefit.grants.read'>, context: HandlerContext<'benefit.grants.read'>) {
    const result = await this.grants.readGrants(context.transaction, input, context);
    return result;
  }
}
