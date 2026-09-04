import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { FinalizeContext, HandlerContext, PrepareContext } from '../../../../foundation/application/HandlerContext';
import type { DurableOperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import type { StorefrontEntry } from '../../../experience/public/ExperienceReadPort';
import type { BootstrapQuery } from '../service/BootstrapQuery';

type BootstrapReply = OperationReply<OperationOutputFor<'storefront.bootstrap.read'>>;
type PreparedBootstrap = Readonly<{ entry: StorefrontEntry; publicScope: boolean }>;

export class BootstrapReadHandler implements DurableOperationHandler<'storefront.bootstrap.read', PreparedBootstrap, BootstrapReply, 'read', StorefrontEntry> {
  readonly operation = 'storefront.bootstrap.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly bootstrap: BootstrapQuery) {}

  load(_input: OperationInputFor<'storefront.bootstrap.read'>, context: HandlerContext<'storefront.bootstrap.read'>): Promise<StorefrontEntry> {
    return this.bootstrap.entry(context);
  }

  prepare(_input: OperationInputFor<'storefront.bootstrap.read'>, context: PrepareContext<'storefront.bootstrap.read'>, entry: StorefrontEntry): Promise<PreparedBootstrap> {
    return Promise.resolve(Object.freeze({ entry, publicScope: context.security.kind !== 'session' }));
  }

  transactionScope(_input: OperationInputFor<'storefront.bootstrap.read'>, prepared: PreparedBootstrap): string | undefined {
    return prepared.publicScope ? prepared.entry.mall : undefined;
  }

  async commit(input: OperationInputFor<'storefront.bootstrap.read'>, prepared: PreparedBootstrap, context: HandlerContext<'storefront.bootstrap.read'>) {
    context.signal.throwIfAborted();
    const response = (await this.bootstrap.execute(input, context, prepared.entry)) as unknown as BootstrapReply;
    return Object.freeze({ checkpoint: response, response });
  }

  finalize(_input: OperationInputFor<'storefront.bootstrap.read'>, checkpoint: BootstrapReply, _context: FinalizeContext<'storefront.bootstrap.read'>): Promise<BootstrapReply> {
    return Promise.resolve(checkpoint);
  }
}
