import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import { DomainError } from '../../../../platform/error/DomainError';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import type { TrackingRepository } from '../port/TrackingRepository';

export class TrackingReadHandler implements OperationHandler<'fulfillment.tracking.read', 'read'> {
  readonly operation = 'fulfillment.tracking.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly tracking: TrackingRepository) {}
  async execute(input: OperationInputFor<'fulfillment.tracking.read'>, context: HandlerContext<'fulfillment.tracking.read'>): Promise<OperationReply<OperationOutputFor<'fulfillment.tracking.read'>>> {
    const raw = input.query?.order;
    const selected = Array.isArray(raw) ? raw[0] : raw;
    const order = typeof selected === 'string' ? selected.trim().slice(0, 255) : '';
    if (!order) throw new DomainError('VALIDATION_FAILED', { field: 'order' });
    const rows = await this.tracking.read(context.transaction, order, requireSession(context.security).scope.id);
    return { status: 200, body: { items: rows, count: rows.length } as OperationOutputFor<'fulfillment.tracking.read'> };
  }
}
