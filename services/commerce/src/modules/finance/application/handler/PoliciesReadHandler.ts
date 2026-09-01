import type { OperationInputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler } from '../../../../foundation/application/OperationHandler';
import type { PolicyRepository } from '../port/OperationRepositories';

export class PoliciesReadHandler implements OperationHandler<'finance.policies.read', 'read'> {
  readonly operation = 'finance.policies.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly policies: PolicyRepository) {}
  async execute(input: OperationInputFor<'finance.policies.read'>, context: HandlerContext<'finance.policies.read'>) {
    const result = await this.policies.policiesRead(context.transaction, input, context);
    return result;
  }
}
