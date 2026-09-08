import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import { MetricReader } from '../service/MetricReader';

export class MallsReadHandler implements OperationHandler<'reporting.malls.read', 'read'> {
  readonly operation = 'reporting.malls.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly metrics: MetricReader) {}
  execute(input: OperationInputFor<'reporting.malls.read'>, context: HandlerContext<'reporting.malls.read'>): Promise<OperationReply<OperationOutputFor<'reporting.malls.read'>>> {
    return this.metrics.read(this.operation, input, context, 'mall');
  }
}
