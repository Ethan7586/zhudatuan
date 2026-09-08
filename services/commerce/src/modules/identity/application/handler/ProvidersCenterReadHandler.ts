import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import type { ProviderRepository } from '../port/ProviderRepository';

export class ProvidersCenterReadHandler implements OperationHandler<'identity.providers.center.read', 'read'> {
  readonly operation = 'identity.providers.center.read' as const;
  readonly mode = 'read' as const;
  constructor(private readonly providers: Pick<ProviderRepository, 'list'>) {}

  async execute(_input: OperationInputFor<'identity.providers.center.read'>, context: HandlerContext<'identity.providers.center.read'>): Promise<OperationReply<OperationOutputFor<'identity.providers.center.read'>>> {
    const access = requireSession(context.security);
    const items = await this.providers.list(context.transaction, access.scope.tenant);
    return { status: 200, body: { items: [...items], count: items.length } };
  }
}
