import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { ProductRepository } from '../port/ProductRepository';

export class ProductDetailReadHandler implements OperationHandler<'catalog.product.detail.read', 'read'> {
  readonly operation = 'catalog.product.detail.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly products: ProductRepository) {}
  async execute(input: OperationInputFor<'catalog.product.detail.read'>, context: HandlerContext<'catalog.product.detail.read'>): Promise<OperationReply<OperationOutputFor<'catalog.product.detail.read'>>> {
    const access = requireSession(context.security);
    const body = await this.products.detail(context.transaction, input.path.productid, access.scope.id, access.scope.kind === 'store');
    return { status: 200, body: body as unknown as OperationOutputFor<'catalog.product.detail.read'> };
  }
}
