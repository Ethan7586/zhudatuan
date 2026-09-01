import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { ProductRepository } from '../port/ProductRepository';

export class ProductsArchiveHandler implements OperationHandler<'catalog.products.archive', 'write'> {
  readonly operation = 'catalog.products.archive' as const;
  readonly mode = 'write' as const;
  constructor(private readonly products: ProductRepository) {}
  async execute(input: OperationInputFor<'catalog.products.archive'>, context: WriteHandlerContext<'catalog.products.archive'>): Promise<OperationReply<OperationOutputFor<'catalog.products.archive'>>> {
    const access = requireSession(context.security);
    const archived = await this.products.archive(context.transaction, input.path.productid, access.scope.id, context.expectedVersion ?? null);
    return { status: 200, body: archived as unknown as OperationOutputFor<'catalog.products.archive'> };
  }
}
