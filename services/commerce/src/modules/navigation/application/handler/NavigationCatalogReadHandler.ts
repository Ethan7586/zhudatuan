import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { ReadNavigationCatalog } from '../service/ReadNavigationCatalog';

export class NavigationCatalogReadHandler implements OperationHandler<'navigation.catalog.read', 'read'> {
  readonly operation = 'navigation.catalog.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly catalog: ReadNavigationCatalog) {}

  execute(_input: OperationInputFor<'navigation.catalog.read'>, context: HandlerContext<'navigation.catalog.read'>): Promise<OperationReply<OperationOutputFor<'navigation.catalog.read'>>> {
    context.signal.throwIfAborted();
    return Promise.resolve(this.catalog.execute() as unknown as OperationReply<OperationOutputFor<'navigation.catalog.read'>>);
  }
}
