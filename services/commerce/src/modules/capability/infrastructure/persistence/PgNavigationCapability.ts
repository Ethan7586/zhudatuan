import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { DatabasePool } from '../../../../platform/database/Pool';
import { databaseInteger } from '../../../../platform/database/DatabaseInteger';
import type { NavigationCapability, NavigationCapabilityPort } from '../../public/NavigationCapabilityPort';
interface CapabilityRow {
  readonly scope_id: string;
  readonly capability_code: string;
  readonly capability_version: number | string;
}
export class PgNavigationCapability implements NavigationCapabilityPort {
  private readonly transactions = new PgTransactionAccess();
  async read(context: ReadTransactionContext, scopes: readonly string[], target: Parameters<NavigationCapabilityPort['read']>[2]): Promise<readonly NavigationCapability[]> {
    const database = this.transactions.database(context);
    if (scopes.length === 0) return Object.freeze([]);
    const result = await database.query<CapabilityRow>('select scope_id,capability_code,capability_version from capability.navigation_capabilities($1,$2)', [scopes, target]);
    const grouped = new Map<
      string,
      {
        values: Set<string>;
        version: number;
      }
    >();
    for (const row of result.rows) {
      const value = grouped.get(row.scope_id) ?? { values: new Set<string>(), version: 0 };
      value.values.add(row.capability_code);
      value.version = Math.max(value.version, databaseInteger(row.capability_version));
      grouped.set(row.scope_id, value);
    }
    return Object.freeze(
      scopes.map((scope) => {
        const value = grouped.get(scope) ?? { values: new Set<string>(), version: 0 };
        return Object.freeze({ scope, capabilities: value.values, version: value.version });
      })
    );
  }
}
