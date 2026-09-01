import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import { MetricReader } from '../service/MetricReader';

export class VoucherConsumptionReadHandler implements OperationHandler<'reporting.voucherconsumption.read', 'read'> {
  readonly operation = 'reporting.voucherconsumption.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly metrics: MetricReader) {}
  execute(input: OperationInputFor<'reporting.voucherconsumption.read'>, context: HandlerContext<'reporting.voucherconsumption.read'>): Promise<OperationReply<OperationOutputFor<'reporting.voucherconsumption.read'>>> {
    return this.metrics.read(this.operation, input, context, requireSession(context.security).scope.id, 'voucher');
  }
}
