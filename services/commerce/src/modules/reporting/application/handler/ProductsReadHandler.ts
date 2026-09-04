import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { MetricReader } from '../service/MetricReader';

export class ProductsReadHandler implements OperationHandler<'reporting.products.read', 'read'> {
  readonly operation = 'reporting.products.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly metrics: MetricReader) {}
  execute(input: OperationInputFor<'reporting.products.read'>, context: HandlerContext<'reporting.products.read'>): Promise<OperationReply<OperationOutputFor<'reporting.products.read'>>> {
    return this.metrics.read(this.operation, input, context, 'product');
  }
}
