import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { BootstrapQuery } from '../service/BootstrapQuery';

export class BootstrapReadHandler implements OperationHandler<'storefront.bootstrap.read', 'read'> {
  readonly operation = 'storefront.bootstrap.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly bootstrap: BootstrapQuery) {}

  async execute(input: OperationInputFor<'storefront.bootstrap.read'>, context: HandlerContext<'storefront.bootstrap.read'>): Promise<OperationReply<OperationOutputFor<'storefront.bootstrap.read'>>> {
    context.signal.throwIfAborted();
    return (await this.bootstrap.execute(input, context)) as unknown as OperationReply<OperationOutputFor<'storefront.bootstrap.read'>>;
  }
}
