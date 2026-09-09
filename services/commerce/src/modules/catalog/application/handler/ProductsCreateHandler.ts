import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import { bodyRecord, textField } from '../../../../pipeline/Validation';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import type { ProductRepository } from '../port/ProductRepository';
import { productRecordEvent } from '../../domain/event/CatalogEvents';
import { productAttributes } from '../../domain/model/ProductAttributes';
import { productImage, type ProductMedia } from '../service/ProductMedia';
import { productOutput } from '../service/ProductOutput';

export class ProductsCreateHandler implements OperationHandler<'catalog.products.create', 'write'> {
  readonly operation = 'catalog.products.create' as const;
  readonly mode = 'write' as const;
  constructor(
    private readonly products: ProductRepository,
    private readonly media: ProductMedia
  ) {}
  async execute(input: OperationInputFor<'catalog.products.create'>, context: WriteHandlerContext<'catalog.products.create'>): Promise<OperationReply<OperationOutputFor<'catalog.products.create'>>> {
    const access = requireSession(context.security);
    const body = bodyRecord(input);
    const supplier = access.actor.target === 'supplier';
    const coverObject = await this.media.verify(body.image === undefined ? undefined : productImage(body.image));
    const submitted = body.attributes && typeof body.attributes === 'object' && !Array.isArray(body.attributes) ? (body.attributes as Readonly<Record<string, unknown>>) : null;
    const created = await this.products.create(context.transaction, {
      scope: access.scope.id,
      owner: supplier ? access.scope.id : typeof body.owner === 'string' ? body.owner : null,
      brand: supplier ? null : typeof body.brand === 'string' ? body.brand : null,
      category: textField(body, 'category'),
      title: textField(body, 'title', 300),
      kind: typeof body.type === 'string' ? (body.type as 'physical' | 'virtual' | 'service' | 'voucher') : 'physical',
      attributes: productAttributes({}, submitted, coverObject),
    });
    return { status: 201, body: productOutput(created) as unknown as OperationOutputFor<'catalog.products.create'>, events: [productRecordEvent('catalog.product.created', created, { actor: access.actor.id, trace: context.traceId })] };
  }
}
