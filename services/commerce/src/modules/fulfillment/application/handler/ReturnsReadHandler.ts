import { FULFILLMENT_RETURN_STATES, type OperationInputFor, type OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import { keysetPage, queryIdentifiers, queryPage } from '../../../../pipeline/Validation';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import type { StoreWorkRepository } from '../port/StoreWorkRepository';

export class ReturnsReadHandler implements OperationHandler<'fulfillment.returns.read', 'read'> {
  readonly operation = 'fulfillment.returns.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly work: StoreWorkRepository) {}
  async execute(input: OperationInputFor<'fulfillment.returns.read'>, context: HandlerContext<'fulfillment.returns.read'>): Promise<OperationReply<OperationOutputFor<'fulfillment.returns.read'>>> {
    const states = queryIdentifiers(input, 'state', FULFILLMENT_RETURN_STATES.length);
    if (states.some((state) => !FULFILLMENT_RETURN_STATES.includes(state as (typeof FULFILLMENT_RETURN_STATES)[number]))) throw new Error('FULFILLMENT_RETURN_STATE_INVALID');
    const page = queryPage(input, 100);
    const rows = await this.work.returns(context.transaction, requireSession(context.security).scope.id, states, page);
    return { status: 200, body: keysetPage(rows, page, 'updated_at') as OperationOutputFor<'fulfillment.returns.read'> };
  }
}
