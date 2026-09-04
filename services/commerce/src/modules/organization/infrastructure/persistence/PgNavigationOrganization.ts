import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import { isNavigationScopeKind, type ScopeKind } from '@shop/authz';
import type { DatabasePool } from '../../../../foundation/persistence/Pool';
import { databaseInteger } from '../../../../foundation/persistence/DatabaseInteger';
import type { NavigationOrganizationPort, NavigationScope } from '../../public/NavigationOrganizationPort';
interface ScopeRow {
  readonly membership_id: string;
  readonly scope_id: string;
  readonly scope_kind: string;
  readonly scope_status: string;
  readonly scope_version: number | string;
  readonly is_default: boolean;
}
export class PgNavigationOrganization implements NavigationOrganizationPort {
  private readonly transactions = new PgTransactionAccess();
  async read(context: ReadTransactionContext, memberships: readonly string[]): Promise<readonly NavigationScope[]> {
    const database = this.transactions.database(context);
    if (memberships.length === 0) return Object.freeze([]);
    const result = await database.query<ScopeRow>('select membership_id,scope_id,scope_kind,scope_status,scope_version,is_default from organization.navigation_scopes($1)', [memberships]);
    return Object.freeze(
      result.rows.flatMap((row) => {
        const kind = row.scope_kind as ScopeKind;
        if (!isNavigationScopeKind(kind)) return [];
        return [Object.freeze({ membership: row.membership_id, id: row.scope_id, kind, status: row.scope_status, version: databaseInteger(row.scope_version), default: row.is_default })];
      })
    );
  }
}
