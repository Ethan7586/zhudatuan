import type { OperationInputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler } from '../../../../pipeline/OperationHandler';
import type { PlanRepository } from '../port/PlanRepository';
export class PlansReadHandler implements OperationHandler<'benefit.plans.read', 'read'> {
  readonly operation = 'benefit.plans.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly plans: PlanRepository) {}
  async execute(input: OperationInputFor<'benefit.plans.read'>, context: HandlerContext<'benefit.plans.read'>) {
    const result = await this.plans.readPlans(context.transaction, input, context);
    return result;
  }
}
