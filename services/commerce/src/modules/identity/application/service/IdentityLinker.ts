import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import type { IdentityLinkRepository } from '../port/IdentityLinkRepository';
export class IdentityLinker {
  constructor(private readonly links: IdentityLinkRepository) {}
  list(database: OperationDatabase, principal: string) {
    return this.links.list(database, principal);
  }
  create(database: OperationDatabase, input: Parameters<IdentityLinkRepository['create']>[1]) {
    return this.links.create(database, input);
  }
  revoke(database: OperationDatabase, principal: string, link: string) {
    return this.links.revoke(database, principal, link);
  }
}
