import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import { MetricReader } from '../service/MetricReader';

export class SalesReadHandler implements OperationHandler<'reporting.sales.read', 'read'> {
  readonly operation = 'reporting.sales.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly metrics: MetricReader) {}
  execute(input: OperationInputFor<'reporting.sales.read'>, context: HandlerContext<'reporting.sales.read'>): Promise<OperationReply<OperationOutputFor<'reporting.sales.read'>>> {
    const access = requireSession(context.security);
    return this.metrics.read(this.operation, input, context, access.scope.id, 'sales');
  }
}
