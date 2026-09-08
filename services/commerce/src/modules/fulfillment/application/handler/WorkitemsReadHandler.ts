import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import { keysetPage, queryIdentifiers, queryPage } from '../../../../pipeline/Validation';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import type { FulfillmentStatus } from '../../domain/model/FulfillmentState';
import type { StoreWorkRepository } from '../port/StoreWorkRepository';

const STATES = new Set<FulfillmentStatus>(['pending', 'submitted', 'accepted', 'processing', 'ready', 'completed', 'cancelled', 'failed', 'needsaction']);

export class WorkitemsReadHandler implements OperationHandler<'fulfillment.workitems.read', 'read'> {
  readonly operation = 'fulfillment.workitems.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly work: StoreWorkRepository) {}
  async execute(input: OperationInputFor<'fulfillment.workitems.read'>, context: HandlerContext<'fulfillment.workitems.read'>): Promise<OperationReply<OperationOutputFor<'fulfillment.workitems.read'>>> {
    const states = queryIdentifiers(input, 'state', STATES.size);
    if (states.some((state) => !STATES.has(state as FulfillmentStatus))) throw new Error('FULFILLMENT_WORK_STATE_INVALID');
    const page = queryPage(input, 100);
    const rows = await this.work.work(context.transaction, requireSession(context.security).scope.id, states as readonly FulfillmentStatus[], page);
    return { status: 200, body: keysetPage(rows, page, 'updated_at') as OperationOutputFor<'fulfillment.workitems.read'> };
  }
}
