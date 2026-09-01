import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { CatalogQuery } from '../service/CatalogQuery';

export class CatalogReadHandler implements OperationHandler<'storefront.catalog.read', 'read'> {
  readonly operation = 'storefront.catalog.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly catalog: CatalogQuery) {}

  async execute(input: OperationInputFor<'storefront.catalog.read'>, context: HandlerContext<'storefront.catalog.read'>): Promise<OperationReply<OperationOutputFor<'storefront.catalog.read'>>> {
    context.signal.throwIfAborted();
    return (await this.catalog.execute(input, context)) as unknown as OperationReply<OperationOutputFor<'storefront.catalog.read'>>;
  }
}
