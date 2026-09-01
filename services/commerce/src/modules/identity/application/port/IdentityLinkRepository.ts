import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';

import type { IdentityLink } from '../../domain/model/IdentityLink';
export interface IdentityLinkRepository {
  list(context: ReadTransactionContext, principal: string): Promise<readonly IdentityLink[]>;
  create(context: WriteTransactionContext, input: Readonly<{ principal: string; membership: string; provider: string; subjecthash: Buffer; ciphertext: string; keyversion: string }>): Promise<IdentityLink>;
  revoke(context: WriteTransactionContext, principal: string, link: string): Promise<void>;
}
