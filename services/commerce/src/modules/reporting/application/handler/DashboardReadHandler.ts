import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { MetricReader } from '../service/MetricReader';

export class DashboardReadHandler implements OperationHandler<'reporting.dashboard.read', 'read'> {
  readonly operation = 'reporting.dashboard.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly metrics: MetricReader) {}
  execute(input: OperationInputFor<'reporting.dashboard.read'>, context: HandlerContext<'reporting.dashboard.read'>): Promise<OperationReply<OperationOutputFor<'reporting.dashboard.read'>>> {
    return this.metrics.read(this.operation, input, context, null);
  }
}
