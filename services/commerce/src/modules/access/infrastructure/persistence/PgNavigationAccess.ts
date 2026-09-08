import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { DatabasePool } from '../../../../platform/database/Pool';
import type { NavigationAccess, NavigationAccessPort } from '../../public/NavigationAccessPort';
import type { AuthorizationRepository } from '../../application/port/AuthorizationRepository';
import { PgAuthorizationRepository } from './PgAuthorizationRepository';
export class PgNavigationAccess implements NavigationAccessPort {
  private readonly transactions = new PgTransactionAccess();
  constructor(private readonly repository: AuthorizationRepository = new PgAuthorizationRepository()) {}
  async read(context: ReadTransactionContext, memberships: readonly string[]): Promise<readonly NavigationAccess[]> {
    const database = this.transactions.database(context);
    if (memberships.length === 0) return Object.freeze([]);
    const result = await this.repository.navigation(context, memberships);
    const grouped = new Map<
      string,
      {
        allow: Set<string>;
        deny: Set<string>;
        version: number;
      }
    >();
    for (const row of result) {
      const value = grouped.get(row.membership) ?? { allow: new Set<string>(), deny: new Set<string>(), version: row.accessVersion };
      if (row.effect !== null && row.permission !== null) value[row.effect].add(row.permission);
      value.version = Math.max(value.version, row.accessVersion);
      grouped.set(row.membership, value);
    }
    return Object.freeze(
      memberships.map((membership) => {
        const value = grouped.get(membership) ?? { allow: new Set<string>(), deny: new Set<string>(), version: 0 };
        return Object.freeze({ membership, permissions: new Set([...value.allow].filter((permission) => !value.deny.has(permission))), version: value.version });
      })
    );
  }
}
