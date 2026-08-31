import type { DatabasePool } from '../../../foundation/persistence/Pool';
import type { NavigationAccess, NavigationAccessPort } from '../public/NavigationAccessPort';
import type { AuthorizationRepository } from '../application/port/AuthorizationRepository';
import { PgAuthorizationRepository } from './persistence/PgAuthorizationRepository';

export class PgNavigationAccess implements NavigationAccessPort {
  constructor(private readonly repository: AuthorizationRepository = new PgAuthorizationRepository()) {}
  async read(database: DatabasePool, memberships: readonly string[]): Promise<readonly NavigationAccess[]> {
    if (memberships.length === 0) return Object.freeze([]);
    const result = await this.repository.navigation(database, memberships);
    const grouped = new Map<string, { allow: Set<string>; deny: Set<string>; version: number }>();
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
