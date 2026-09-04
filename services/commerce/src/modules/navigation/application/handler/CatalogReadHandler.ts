import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { FinalizeContext, HandlerContext, PrepareContext } from '../../../../foundation/application/HandlerContext';
import type { DurableOperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { StorefrontEntry } from '../../../experience/public/ExperienceReadPort';
import type { CatalogQuery } from '../service/CatalogQuery';

type CatalogReply = OperationReply<OperationOutputFor<'storefront.catalog.read'>>;
type PreparedCatalog = Readonly<{ entry: StorefrontEntry; publicScope: boolean }>;

export class CatalogReadHandler implements DurableOperationHandler<'storefront.catalog.read', PreparedCatalog, CatalogReply, 'read', StorefrontEntry> {
  readonly operation = 'storefront.catalog.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly catalog: CatalogQuery) {}

  load(_input: OperationInputFor<'storefront.catalog.read'>, context: HandlerContext<'storefront.catalog.read'>): Promise<StorefrontEntry> {
    return this.catalog.entry(context);
  }

  prepare(_input: OperationInputFor<'storefront.catalog.read'>, context: PrepareContext<'storefront.catalog.read'>, entry: StorefrontEntry): Promise<PreparedCatalog> {
    return Promise.resolve(Object.freeze({ entry, publicScope: context.security.kind !== 'session' }));
  }

  transactionScope(_input: OperationInputFor<'storefront.catalog.read'>, prepared: PreparedCatalog): string | undefined {
    return prepared.publicScope ? prepared.entry.mall : undefined;
  }

  async commit(input: OperationInputFor<'storefront.catalog.read'>, prepared: PreparedCatalog, context: HandlerContext<'storefront.catalog.read'>) {
    context.signal.throwIfAborted();
    const response = (await this.catalog.execute(input, context, prepared.entry)) as unknown as CatalogReply;
    return Object.freeze({ checkpoint: response, response });
  }

  finalize(_input: OperationInputFor<'storefront.catalog.read'>, checkpoint: CatalogReply, _context: FinalizeContext<'storefront.catalog.read'>): Promise<CatalogReply> {
    return Promise.resolve(checkpoint);
  }
}
