import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { HandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import type { CartOwnerRepository } from '../port/CartOwnerRepository';
import type { CartRepository } from '../port/CartRepository';

export class CurrentReadHandler implements OperationHandler<'cart.current.read', 'read'> {
  readonly operation = 'cart.current.read' as const;
  readonly mode = 'read' as const;
  constructor(
    private readonly carts: CartRepository,
    private readonly owners: CartOwnerRepository
  ) {}
  async execute(_input: OperationInputFor<'cart.current.read'>, context: HandlerContext<'cart.current.read'>): Promise<OperationReply<OperationOutputFor<'cart.current.read'>>> {
    const owner = await this.owners.resolve(context.transaction, requireSession(context.security).membership.id);
    if (!owner.application) return { status: 200, body: { items: [], version: 0 } as OperationOutputFor<'cart.current.read'> };
    const current = await this.carts.current(context.transaction, owner.member, owner.mall, owner.application);
    return { status: 200, body: (current ?? { items: [], version: 0 }) as OperationOutputFor<'cart.current.read'> };
  }
}
