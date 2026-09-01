import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { bodyRecord, textField } from '../../../../foundation/interface/Validation';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { FulfillmentRepository } from '../port/FulfillmentRepository';

export class ShipmentsCreateHandler implements OperationHandler<'fulfillment.shipments.create', 'write'> {
  readonly operation = 'fulfillment.shipments.create' as const;
  readonly mode = 'write' as const;
  constructor(private readonly fulfillments: FulfillmentRepository) {}
  async execute(input: OperationInputFor<'fulfillment.shipments.create'>, context: WriteHandlerContext<'fulfillment.shipments.create'>): Promise<OperationReply<OperationOutputFor<'fulfillment.shipments.create'>>> {
    const access = requireSession(context.security);
    const body = bodyRecord(input);
    const result = await this.fulfillments.ship(context.transaction, { id: input.path.fulfillmentid, scope: access.scope.id, actor: access.actor.id, tracking: textField(body, 'tracking', 128), carrier: body.carrier ?? null });
    return { status: 201, body: result as OperationOutputFor<'fulfillment.shipments.create'> };
  }
}
