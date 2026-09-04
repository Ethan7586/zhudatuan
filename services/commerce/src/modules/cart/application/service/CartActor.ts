import type { HandlerContext, WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { ReadTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import { DomainError } from '../../../../foundation/domain/DomainError';
import { sessionAccess } from '../../../../foundation/security/OperationSecurityContext';
import type { CartOwnerRepository } from '../port/CartOwnerRepository';
import type { CartOwner } from '../../domain/model/Cart';
import { CartToken } from '../../domain/model/CartToken';

export class CartActor {
  constructor(private readonly owners: CartOwnerRepository) {}

  async read(context: HandlerContext): Promise<CartOwner | null> {
    const session = sessionAccess(context.security);
    if (session) return this.owners.member(context.transaction, session.membership.id);
    const token = CartToken.optional(context.headers['x-cart-token']);
    return token ? this.anonymous(context.transaction, context.headers['x-storefront-handle'], token.digest) : null;
  }

  async write(context: WriteHandlerContext): Promise<CartOwner> {
    const session = sessionAccess(context.security);
    if (session) return this.owners.member(context.transaction, session.membership.id);
    const token = CartToken.required(context.headers['x-cart-token']);
    return this.anonymous(context.transaction, context.headers['x-storefront-handle'], token.digest);
  }

  member(context: WriteHandlerContext) {
    const session = sessionAccess(context.security);
    if (!session) throw new Error('SESSION_CONTEXT_REQUIRED');
    return this.owners.member(context.transaction, session.membership.id);
  }

  token(context: HandlerContext | WriteHandlerContext): string {
    return CartToken.required(context.headers['x-cart-token']).digest;
  }

  private async anonymous(context: ReadTransactionContext, handle: string | undefined, tokenDigest: string): Promise<CartOwner> {
    if (!handle) throw new DomainError('VALIDATION_FAILED', { field: 'x-storefront-handle' });
    const scope = await this.owners.anonymous(context, handle);
    return Object.freeze({ kind: 'anonymous', tokenDigest, ...scope });
  }
}
