import type { ReadTransactionContext } from '../../../../platform/database/TransactionContext';
import type { CartOwner } from '../../domain/model/Cart';

export interface MemberCartOwner extends Extract<CartOwner, { kind: 'member' }> {}
export interface AnonymousCartScope {
  readonly mall: string;
  readonly application: string;
}

export interface CartOwnerRepository {
  member(context: ReadTransactionContext, membership: string): Promise<MemberCartOwner>;
  anonymous(context: ReadTransactionContext, handle: string): Promise<AnonymousCartScope>;
}
