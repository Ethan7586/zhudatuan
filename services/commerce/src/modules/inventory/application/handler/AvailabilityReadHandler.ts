import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { latestWatermark } from '../../../../foundation/application/Watermark';
import { queryIdentifiers, queryText } from '../../../../foundation/application/Validation';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { InventoryReadPort } from '../../public/InventoryReadPort';

export class AvailabilityReadHandler implements OperationHandler<'inventory.availability.read', 'read'> {
  readonly operation = 'inventory.availability.read' as const;
  readonly mode = 'read' as const;

  constructor(private readonly inventory: InventoryReadPort) {}

  async execute(input: OperationInputFor<'inventory.availability.read'>, context: HandlerContext<'inventory.availability.read'>): Promise<OperationReply<OperationOutputFor<'inventory.availability.read'>>> {
    const access = requireSession(context.security);
    const items = await this.inventory.details(context.transaction, access.scope.id, queryIdentifiers(input, 'sku'), queryText(input, 'source'));
    return {
      status: 200,
      body: {
        items: items.map((item) => ({ ...item, reservation: { ...item.reservation }, sources: item.sources.map((source) => ({ ...source })) })),
        count: items.length,
        watermark: latestWatermark(items.map(({ watermark }) => watermark)),
      },
    };
  }
}
