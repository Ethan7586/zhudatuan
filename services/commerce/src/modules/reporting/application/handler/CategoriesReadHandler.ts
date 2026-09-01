import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import { MetricReader } from '../service/MetricReader';

export class CategoriesReadHandler implements OperationHandler<'reporting.categories.read', 'read'> {
  readonly operation = 'reporting.categories.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly metrics: MetricReader) {}
  execute(input: OperationInputFor<'reporting.categories.read'>, context: HandlerContext<'reporting.categories.read'>): Promise<OperationReply<OperationOutputFor<'reporting.categories.read'>>> {
    const access = requireSession(context.security);
    return this.metrics.read(this.operation, input, context, access.scope.id, 'category');
  }
}
