import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { Scope, ScopeGrant } from '@shop/authz';
import type { AuthorizationRepository, AuthorizationSnapshotRecord, EffectivePermissionRecord, EffectiveScopeRecord, NavigationAuthorizationRecord } from '../../application/port/AuthorizationRepository';
import type { AuthorizationRole } from '../../../../foundation/security/AuthorizationSnapshot';
interface SnapshotRow {
  readonly membership_id: string;
  readonly membership_active: boolean;
  readonly access_version: number;
  readonly credential_version: number;
  readonly organization_id: string;
  readonly target: 'console' | 'storefront';
  readonly role_assignments: AuthorizationRole[];
  readonly permission_allows: string[];
  readonly permission_denies: string[];
  readonly scopes: ScopeGrant[];
  readonly resource_scope: Scope;
  readonly operation_ids: string[];
  readonly capability_version: number;
}
interface NavigationRow {
  readonly membership_id: string;
  readonly permission_code: string | null;
  readonly effect: 'allow' | 'deny' | null;
  readonly access_version: number;
}
interface PermissionRow {
  readonly permission_code: string;
  readonly effect: 'allow' | 'deny';
}
interface ScopeRow {
  readonly scope_id: string;
  readonly effect: 'allow' | 'deny';
}
export class PgAuthorizationRepository implements AuthorizationRepository {
  private readonly transactions = new PgTransactionAccess();
  async snapshot(
    context: ReadTransactionContext,
    input: Readonly<{
      membership: string;
      target: 'console' | 'storefront';
      operation: string;
      resource: string | null;
    }>
  ): Promise<AuthorizationSnapshotRecord | null> {
    const database = this.transactions.database(context);
    const result = await database.query<SnapshotRow>(
      `select membership_id,membership_active,access_version,credential_version,
      organization_id,target,role_assignments,permission_allows,permission_denies,scopes,resource_scope,operation_ids,capability_version
      from access.authorization_snapshot($1,$2,$3,$4)`,
      [input.membership, input.target, input.operation, input.resource]
    );
    const row = result.rows[0];
    return row
      ? Object.freeze({
          membership: row.membership_id,
          active: row.membership_active,
          accessVersion: Number(row.access_version),
          credentialVersion: Number(row.credential_version),
          organization: row.organization_id,
          target: row.target,
          roles: Object.freeze(row.role_assignments.map((role) => Object.freeze(role))),
          allows: Object.freeze([...row.permission_allows]),
          denies: Object.freeze([...row.permission_denies]),
          scopes: Object.freeze([...row.scopes]),
          resource: row.resource_scope,
          operations: Object.freeze([...row.operation_ids]),
          capabilityVersion: Number(row.capability_version),
        })
      : null;
  }
  async navigation(context: ReadTransactionContext, memberships: readonly string[]): Promise<readonly NavigationAuthorizationRecord[]> {
    const database = this.transactions.database(context);
    if (memberships.length === 0) return Object.freeze([]);
    const result = await database.query<NavigationRow>(
      `select membership_id,permission_code,effect,access_version
      from access.navigation_access($1)`,
      [memberships]
    );
    return Object.freeze(result.rows.map((row) => Object.freeze({ membership: row.membership_id, permission: row.permission_code, effect: row.effect, accessVersion: Number(row.access_version) })));
  }
  async permissions(context: ReadTransactionContext, membership: string): Promise<readonly EffectivePermissionRecord[]> {
    const database = this.transactions.database(context);
    const result = await database.query<PermissionRow>('select permission_code,effect from access.effective_permissions($1)', [membership]);
    return Object.freeze(result.rows.map((row) => Object.freeze({ permission: row.permission_code, effect: row.effect })));
  }
  async scopes(context: ReadTransactionContext, membership: string): Promise<readonly EffectiveScopeRecord[]> {
    const database = this.transactions.database(context);
    const result = await database.query<ScopeRow>(`select scope->>'id' scope_id,effect from access.effective_scopes($1)`, [membership]);
    return Object.freeze(result.rows.map((row) => Object.freeze({ scope: row.scope_id, effect: row.effect })));
  }
}
