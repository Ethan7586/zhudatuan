import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { bodyRecord } from '../../../../foundation/interface/Validation';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { ProductRepository } from '../port/ProductRepository';

export class ProductsUpdateHandler implements OperationHandler<'catalog.products.update', 'write'> {
  readonly operation = 'catalog.products.update' as const;
  readonly mode = 'write' as const;
  constructor(private readonly products: ProductRepository) {}
  async execute(input: OperationInputFor<'catalog.products.update'>, context: WriteHandlerContext<'catalog.products.update'>): Promise<OperationReply<OperationOutputFor<'catalog.products.update'>>> {
    const access = requireSession(context.security);
    const body = bodyRecord(input);
    const updated = await this.products.update(context.transaction, {
      id: input.path.productid,
      scope: access.scope.id,
      title: typeof body.title === 'string' ? body.title : null,
      category: typeof body.category === 'string' ? body.category : null,
      attributes: body.attributes && typeof body.attributes === 'object' && !Array.isArray(body.attributes) ? (body.attributes as Readonly<Record<string, unknown>>) : null,
      status: typeof body.status === 'string' ? body.status : null,
      expectedVersion: context.expectedVersion ?? null,
    });
    return { status: 200, body: updated as unknown as OperationOutputFor<'catalog.products.update'> };
  }
}
