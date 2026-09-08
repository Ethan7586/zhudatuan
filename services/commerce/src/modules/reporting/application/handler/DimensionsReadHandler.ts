import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import type { DimensionReader } from '../service/DimensionReader';

export class DimensionsReadHandler implements OperationHandler<'reporting.dimensions.read', 'read'> {
  readonly operation = 'reporting.dimensions.read' as const;
  readonly mode = 'read' as const;

  constructor(private readonly dimensions: DimensionReader) {}

  async execute(_input: OperationInputFor<'reporting.dimensions.read'>, context: HandlerContext<'reporting.dimensions.read'>): Promise<OperationReply<OperationOutputFor<'reporting.dimensions.read'>>> {
    const scope = requireSession(context.security).scope.id;
    return { status: 200, body: (await this.dimensions.catalogFor(context.transaction, scope)) as unknown as OperationOutputFor<'reporting.dimensions.read'> };
  }
}
