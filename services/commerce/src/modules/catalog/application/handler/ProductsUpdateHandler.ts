import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import { bodyRecord } from '../../../../pipeline/Validation';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import { DomainError } from '../../../../platform/error/DomainError';
import type { ProductRepository } from '../port/ProductRepository';
import { productRecordEvent } from '../../domain/event/CatalogEvents';

export class ProductsUpdateHandler implements OperationHandler<'catalog.products.update', 'write'> {
  readonly operation = 'catalog.products.update' as const;
  readonly mode = 'write' as const;
  constructor(private readonly products: ProductRepository) {}
  async execute(input: OperationInputFor<'catalog.products.update'>, context: WriteHandlerContext<'catalog.products.update'>): Promise<OperationReply<OperationOutputFor<'catalog.products.update'>>> {
    const access = requireSession(context.security);
    const body = bodyRecord(input);
    const status = typeof body.status === 'string' ? (body.status as 'draft' | 'review' | 'active' | 'archived') : null;
    if (access.actor.target === 'supplier' && status !== null && status !== 'draft' && status !== 'review') throw new DomainError('SCOPE_DENIED');
    const updated = await this.products.update(context.transaction, {
      id: input.path.productid,
      scope: access.scope.id,
      title: typeof body.title === 'string' ? body.title : null,
      category: typeof body.category === 'string' ? body.category : null,
      attributes: body.attributes && typeof body.attributes === 'object' && !Array.isArray(body.attributes) ? (body.attributes as Readonly<Record<string, unknown>>) : null,
      status,
      expectedVersion: context.expectedVersion!,
    });
    const event = body.status === 'archived' ? 'catalog.product.archived' : 'catalog.product.updated';
    return { status: 200, body: updated as unknown as OperationOutputFor<'catalog.products.update'>, events: [productRecordEvent(event, updated, { actor: access.actor.id, trace: context.traceId })] };
  }
}
