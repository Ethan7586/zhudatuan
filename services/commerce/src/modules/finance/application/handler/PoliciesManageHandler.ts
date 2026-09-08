import type { OperationInputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler } from '../../../../pipeline/OperationHandler';
import type { PolicyCommandRepository } from '../port/FinanceCommandRepository';

export class PoliciesManageHandler implements OperationHandler<'finance.policies.manage', 'write'> {
  readonly operation = 'finance.policies.manage' as const;
  readonly mode = 'write' as const;
  constructor(private readonly policies: PolicyCommandRepository) {}
  async execute(input: OperationInputFor<'finance.policies.manage'>, context: WriteHandlerContext<'finance.policies.manage'>) {
    const result = await this.policies.policiesManage(context.transaction, input, context);
    return result;
  }
}
