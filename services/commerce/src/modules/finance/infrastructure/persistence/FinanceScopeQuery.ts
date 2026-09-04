import type { SqlExecutor } from '../../../../adapter/database/PgTransactionAccess';
import type { AccessContext } from '../../../../foundation/security/AccessContext';
import { organizationScope } from '../../../../foundation/security/OrganizationScope';
import type { OrganizationReadPort } from '../../../organization/public';

/** Shared scope query object used by every hierarchical finance projection. */
export class FinanceScopeQuery {
  constructor(private readonly organization: OrganizationReadPort) {}

  descendants(database: SqlExecutor, scope: AccessContext['scope']): Promise<readonly string[]> {
    return this.organization.descendants(database.transaction, organizationScope(scope));
  }

  descendantsFromId(database: SqlExecutor, scopeId: string): Promise<readonly string[]> {
    return this.organization.descendants(database.transaction, scopeId);
  }

  describe(database: SqlExecutor, scopeId: string) {
    return this.organization.scope(database.transaction, scopeId);
  }
}
