import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import type { ProductRepository } from '../port/ProductRepository';
import { productRecordEvent } from '../../domain/event/CatalogEvents';

export class ProductsArchiveHandler implements OperationHandler<'catalog.products.archive', 'write'> {
  readonly operation = 'catalog.products.archive' as const;
  readonly mode = 'write' as const;
  constructor(private readonly products: ProductRepository) {}
  async execute(input: OperationInputFor<'catalog.products.archive'>, context: WriteHandlerContext<'catalog.products.archive'>): Promise<OperationReply<OperationOutputFor<'catalog.products.archive'>>> {
    const access = requireSession(context.security);
    const archived = await this.products.archive(context.transaction, input.path.productid, access.scope.id, context.expectedVersion!);
    return { status: 200, body: archived as unknown as OperationOutputFor<'catalog.products.archive'>, events: [productRecordEvent('catalog.product.archived', archived, { actor: access.actor.id, trace: context.traceId })] };
  }
}
