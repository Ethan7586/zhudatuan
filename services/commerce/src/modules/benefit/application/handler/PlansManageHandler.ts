import type { OperationInputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler } from '../../../../pipeline/OperationHandler';
import type { PlanRepository } from '../port/PlanRepository';
export class PlansManageHandler implements OperationHandler<'benefit.plans.manage', 'write'> {
  readonly operation = 'benefit.plans.manage' as const;
  readonly mode = 'write' as const;
  constructor(private readonly plans: PlanRepository) {}
  async execute(input: OperationInputFor<'benefit.plans.manage'>, context: WriteHandlerContext<'benefit.plans.manage'>) {
    const result = await this.plans.managePlan(context.transaction, input, context);
    return result;
  }
}
