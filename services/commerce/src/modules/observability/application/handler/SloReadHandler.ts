import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import type { OperationalReader } from '../port/OperationalReader';

export class SloReadHandler implements OperationHandler<'observability.slo.read', 'read'> {
  readonly operation = 'observability.slo.read' as const;
  readonly mode = 'read' as const;

  constructor(private readonly reader: OperationalReader) {}

  async execute(_input: OperationInputFor<'observability.slo.read'>, context: HandlerContext<'observability.slo.read'>): Promise<OperationReply<OperationOutputFor<'observability.slo.read'>>> {
    requireSession(context.security);
    const view = await this.reader.serviceLevels();
    return { status: 200, body: { ...view, items: view.items.map((item) => ({ ...item })) } };
  }
}
