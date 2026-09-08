import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import { keysetPage, queryPage } from '../../../../pipeline/Validation';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import type { AdjustmentRepository } from '../port/AdjustmentRepository';

export class AdjustmentsReadHandler implements OperationHandler<'inventory.adjustments.read', 'read'> {
  readonly operation = 'inventory.adjustments.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly adjustments: AdjustmentRepository) {}
  async execute(input: OperationInputFor<'inventory.adjustments.read'>, context: HandlerContext<'inventory.adjustments.read'>): Promise<OperationReply<OperationOutputFor<'inventory.adjustments.read'>>> {
    const page = queryPage(input, 100);
    const rows = await this.adjustments.read(context.transaction, requireSession(context.security).scope.id, page);
    return { status: 200, body: keysetPage(rows, page, 'createdAt') as OperationOutputFor<'inventory.adjustments.read'> };
  }
}
