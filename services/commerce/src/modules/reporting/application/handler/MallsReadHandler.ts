import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import { MetricReader } from '../service/MetricReader';

export class MallsReadHandler implements OperationHandler<'reporting.malls.read', 'read'> {
  readonly operation = 'reporting.malls.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly metrics: MetricReader) {}
  execute(input: OperationInputFor<'reporting.malls.read'>, context: HandlerContext<'reporting.malls.read'>): Promise<OperationReply<OperationOutputFor<'reporting.malls.read'>>> {
    const access = requireSession(context.security);
    return this.metrics.read(this.operation, input, context, access.scope.id, 'mall');
  }
}
