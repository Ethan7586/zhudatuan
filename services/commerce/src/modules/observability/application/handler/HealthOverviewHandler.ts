import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { OperationalReader } from '../port/OperationalReader';

export class HealthOverviewHandler implements OperationHandler<'observability.healthoverview.read', 'read'> {
  readonly operation = 'observability.healthoverview.read' as const;
  readonly mode = 'read' as const;

  constructor(private readonly reader: OperationalReader) {}

  async execute(_input: OperationInputFor<'observability.healthoverview.read'>, context: HandlerContext<'observability.healthoverview.read'>): Promise<OperationReply<OperationOutputFor<'observability.healthoverview.read'>>> {
    requireSession(context.security);
    const view = await this.reader.overview();
    return { status: 200, body: { ...view, degraded: [...view.degraded], dependencies: view.dependencies.map((item) => ({ ...item })), queues: view.queues.map((item) => ({ ...item })), providers: view.providers.map((item) => ({ ...item })) } };
  }
}
