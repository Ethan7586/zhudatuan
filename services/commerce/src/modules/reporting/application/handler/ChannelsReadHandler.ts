import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import { MetricReader } from '../service/MetricReader';

export class ChannelsReadHandler implements OperationHandler<'reporting.channels.read', 'read'> {
  readonly operation = 'reporting.channels.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly metrics: MetricReader) {}
  execute(input: OperationInputFor<'reporting.channels.read'>, context: HandlerContext<'reporting.channels.read'>): Promise<OperationReply<OperationOutputFor<'reporting.channels.read'>>> {
    const access = requireSession(context.security);
    return this.metrics.read(this.operation, input, context, access.scope.id, 'channel');
  }
}
