import type { ReadTransactionContext } from '../../../../platform/database/TransactionContext';
import { requireWriteTransaction } from '../../../../platform/database/TransactionContext';

import type { IdentityLinkRepository } from '../port/IdentityLinkRepository';
export class IdentityLinker {
  constructor(private readonly links: IdentityLinkRepository) {}
  list(database: ReadTransactionContext, principal: string) {
    return this.links.list(database, principal);
  }
  create(database: ReadTransactionContext, input: Parameters<IdentityLinkRepository['create']>[1]) {
    return this.links.create(requireWriteTransaction(database), input);
  }
  revoke(database: ReadTransactionContext, principal: string, link: string) {
    return this.links.revoke(requireWriteTransaction(database), principal, link);
  }
}
