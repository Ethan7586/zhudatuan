import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import { MetricReader } from '../service/MetricReader';

export class PowderClassReadHandler implements OperationHandler<'reporting.powderclass.read', 'read'> {
  readonly operation = 'reporting.powderclass.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly metrics: MetricReader) {}
  execute(input: OperationInputFor<'reporting.powderclass.read'>, context: HandlerContext<'reporting.powderclass.read'>): Promise<OperationReply<OperationOutputFor<'reporting.powderclass.read'>>> {
    return this.metrics.read(this.operation, input, context, requireSession(context.security).scope.id, 'powderclass');
  }
}
