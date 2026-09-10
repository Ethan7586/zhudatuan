import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import { DomainError } from '../../../../platform/error/DomainError';
import type { ReadTransactionContext } from '../../../../platform/database/TransactionContext';

import type { OrganizationReadPort } from '../../../organization/public';
export class CatalogScopeReader {
  private readonly transactions = new PgTransactionAccess();
  constructor(private readonly organizations: OrganizationReadPort) {}
  async visible(context: ReadTransactionContext, scope: string, ancestors: boolean): Promise<readonly string[]> {
    const database = this.transactions.database(context);
    const selected = await this.organizations.scope(database.transaction, scope);
    if (selected.scopeKind === 'supplier') return Object.freeze([selected.id]);
    return Object.freeze([...new Set([selected.id, ...selected.descendants, ...(ancestors ? selected.ancestors : [])])]);
  }
  async listings(context: ReadTransactionContext, scope: string, ancestors: boolean) {
    const database = this.transactions.database(context);
    const visible = await this.visible(database.transaction, scope, ancestors);
    const organizations = await this.organizations.summaries(database.transaction, visible);
    const malls = organizations.filter((organization) => organization.kind === 'mall').map((organization) => organization.id);
    return Object.freeze({ visible, malls: Object.freeze(malls) });
  }
  async assert(context: ReadTransactionContext, accessScope: string, targetScope: string): Promise<void> {
    const database = this.transactions.database(context);
    if (!(await this.visible(database.transaction, accessScope, false)).includes(targetScope)) throw new DomainError('SCOPE_DENIED');
  }
}
