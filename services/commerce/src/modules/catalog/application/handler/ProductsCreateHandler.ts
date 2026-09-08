import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import { bodyRecord, textField } from '../../../../pipeline/Validation';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import type { ProductRepository } from '../port/ProductRepository';
import { productRecordEvent } from '../../domain/event/CatalogEvents';

export class ProductsCreateHandler implements OperationHandler<'catalog.products.create', 'write'> {
  readonly operation = 'catalog.products.create' as const;
  readonly mode = 'write' as const;
  constructor(private readonly products: ProductRepository) {}
  async execute(input: OperationInputFor<'catalog.products.create'>, context: WriteHandlerContext<'catalog.products.create'>): Promise<OperationReply<OperationOutputFor<'catalog.products.create'>>> {
    const access = requireSession(context.security);
    const body = bodyRecord(input);
    const supplier = access.actor.target === 'supplier';
    const created = await this.products.create(context.transaction, {
      scope: access.scope.id,
      owner: supplier ? access.scope.id : typeof body.owner === 'string' ? body.owner : null,
      brand: supplier ? null : typeof body.brand === 'string' ? body.brand : null,
      category: textField(body, 'category'),
      title: textField(body, 'title', 300),
      kind: typeof body.type === 'string' ? (body.type as 'physical' | 'virtual' | 'service' | 'voucher') : 'physical',
      attributes: body.attributes && typeof body.attributes === 'object' && !Array.isArray(body.attributes) ? (body.attributes as Readonly<Record<string, unknown>>) : Object.freeze({}),
    });
    return { status: 201, body: created as unknown as OperationOutputFor<'catalog.products.create'>, events: [productRecordEvent('catalog.product.created', created, { actor: access.actor.id, trace: context.traceId })] };
  }
}
