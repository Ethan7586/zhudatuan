import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import { keysetPage, queryPage } from '../../../../pipeline/Validation';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import type { HandoverRecord, HandoverRepository } from '../port/HandoverRepository';

export class HandoversReadHandler implements OperationHandler<'identity.handovers.read', 'read'> {
  readonly operation = 'identity.handovers.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly handovers: HandoverRepository) {}
  async execute(input: OperationInputFor<'identity.handovers.read'>, context: HandlerContext<'identity.handovers.read'>): Promise<OperationReply<OperationOutputFor<'identity.handovers.read'>>> {
    const page = queryPage(input, 100);
    const rows = await this.handovers.read(context.transaction, requireSession(context.security).scope.id, page);
    return { status: 200, body: keysetPage(rows.map(project), page, 'handedOverAt') as OperationOutputFor<'identity.handovers.read'> };
  }
}

function project(record: HandoverRecord) {
  return Object.freeze({ ...record, handedOverAt: record.handedOverAt.toISOString() });
}
