import { DomainError } from '../../../foundation/domain/DomainError';
import type { DatabasePool } from '../../../foundation/persistence/Pool';
import { databaseInteger } from '../../../foundation/persistence/DatabaseInteger';
import type { NavigationIdentity, NavigationIdentityPort } from '../public/NavigationIdentityPort';

interface IdentityRow {
  readonly principal_id: string;
  readonly membership_id: string;
  readonly membership_status: string;
  readonly access_version: number | string;
  readonly assurance: number | string;
}

export class PgNavigationIdentity implements NavigationIdentityPort {
  async read(database: DatabasePool, principal: string, membership: string): Promise<NavigationIdentity> {
    const result = await database.query<IdentityRow>('select principal_id,membership_id,membership_status,access_version,assurance from identity.navigation_identity($1,$2)', [principal, membership]);
    const row = result.rows[0];
    if (!row || row.membership_status !== 'active') throw new DomainError('MEMBERSHIP_INACTIVE');
    return Object.freeze({
      principal: row.principal_id,
      membership: row.membership_id,
      membershipStatus: row.membership_status,
      accessVersion: databaseInteger(row.access_version),
      assurance: databaseInteger(row.assurance),
    });
  }
}
