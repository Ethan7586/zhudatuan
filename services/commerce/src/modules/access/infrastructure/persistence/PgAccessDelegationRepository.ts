import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { DelegationIssuer, DelegationPermission, DelegationRole, DelegationScope, DelegationTarget, Ownership, VersionChange } from '../../application/port/AccessRepository';
import type { Membership } from '../../domain/model/Membership';
import { PgEmployeeAccessRepository } from './PgEmployeeAccessRepository';
import {
  delegationRole,
  delegationScope,
  membershipModel,
  versionChange,
  type DelegationPermissionRow,
  type DelegationRoleRow,
  type DelegationScopeRow,
  type IssuerRow,
  type MembershipRow,
  type OwnershipRow,
  type TargetRow,
  type VersionRow,
} from './AccessRecord';
import { randomUUID } from 'node:crypto';
import { PgRuntimeWriter } from '../../../../platform/database/PgRuntimeWriter';

export class PgAccessDelegationRepository extends PgEmployeeAccessRepository {
  async lockOwnership(context: WriteTransactionContext, scope: string): Promise<Ownership | null> {
    const database = this.transactions.database(context);
    const result = await database.query<OwnershipRow>(
      `select ownership.scope_id,ownership.role_id,
      ownership.membership_id,ownership.version,role.kind role_kind from access.ownership ownership
      join access.role role on role.id=ownership.role_id where ownership.scope_id=$1 for update of ownership,role`,
      [scope]
    );
    const row = result.rows[0];
    return row ? Object.freeze({ scope: row.scope_id, role: row.role_id, membership: row.membership_id, version: Number(row.version), roleKind: row.role_kind }) : null;
  }
  async lockMemberships(context: WriteTransactionContext, memberships: readonly string[]): Promise<readonly Membership[]> {
    const database = this.transactions.database(context);
    const result = await database.query<MembershipRow>(
      `select id,organization_id,client,status,access_version
      from access.membership where id=any($1::text[]) order by id for update`,
      [memberships]
    );
    return Object.freeze(result.rows.map(membershipModel));
  }
  async incrementVersion(context: WriteTransactionContext, membership: string): Promise<VersionChange | null> {
    const database = this.transactions.database(context);
    const result = await database.query<VersionRow>(
      `update access.membership set access_version=access_version+1
      where id=$1 returning id membership_id,organization_id,access_version`,
      [membership]
    );
    return versionChange(result.rows[0]);
  }
  async incrementRoleVersions(context: WriteTransactionContext, role: string): Promise<readonly VersionChange[]> {
    const database = this.transactions.database(context);
    const result = await database.query<VersionRow>(
      `update access.membership membership
      set access_version=membership.access_version+1
      where exists(select 1 from access.membershiprole assignment where assignment.membership_id=membership.id
        and assignment.role_id=$1 and assignment.effective_at<=clock_timestamp()
        and (assignment.expires_at is null or assignment.expires_at>clock_timestamp()))
      returning membership.id membership_id,membership.organization_id,membership.access_version`,
      [role]
    );
    return Object.freeze(result.rows.map((row) => versionChange(row)!));
  }
  async activate(context: WriteTransactionContext, membership: string): Promise<VersionChange | null> {
    const database = this.transactions.database(context);
    const result = await database.query<VersionRow>(
      `update access.membership
      set status='active',access_version=access_version+1,joined_at=coalesce(joined_at,clock_timestamp())
      where id=$1 and status='invited' returning id membership_id,organization_id,access_version`,
      [membership]
    );
    return versionChange(result.rows[0]);
  }
  async versionChanged(context: WriteTransactionContext, changes: readonly VersionChange[], reason: string, trace: string): Promise<void> {
    const database = this.transactions.database(context);
    const runtime = new PgRuntimeWriter(database);
    for (const change of changes)
      await runtime.append({
        id: `event:${randomUUID()}`,
        type: 'access.version.changed',
        aggregateType: 'membership',
        aggregate: change.membership,
        scope: change.organization,
        payload: { membership: change.membership, version: change.version, reason },
        trace,
      });
  }
  async membershipActivated(
    context: WriteTransactionContext,
    input: Readonly<{
      change: VersionChange;
      invitation: string;
      target: 'storefront';
      grantDigest: string;
      trace: string;
    }>
  ): Promise<void> {
    const database = this.transactions.database(context);
    await new PgRuntimeWriter(database).append({
      id: `event:${randomUUID()}`,
      type: 'access.membership.activated',
      aggregateType: 'membership',
      aggregate: input.change.membership,
      scope: input.change.organization,
      payload: { membershipId: input.change.membership, accessVersion: input.change.version, invitationId: input.invitation, target: input.target, grantDigest: input.grantDigest },
      trace: input.trace,
    });
  }
  async delegationIssuer(context: ReadTransactionContext, membership: string): Promise<DelegationIssuer | null> {
    const database = this.transactions.database(context);
    const result = await database.query<IssuerRow>(
      `select organization_id,access_version from access.membership
      where id=$1 and status='active'`,
      [membership]
    );
    const row = result.rows[0];
    return row ? Object.freeze({ organization: row.organization_id, accessVersion: Number(row.access_version) }) : null;
  }
  async delegationTarget(context: ReadTransactionContext, membership: string): Promise<DelegationTarget | null> {
    const database = this.transactions.database(context);
    const result = await database.query<TargetRow>(
      `select id,organization_id,principal_id,status,client
      from access.membership where id=$1`,
      [membership]
    );
    const row = result.rows[0];
    return row ? Object.freeze({ id: row.id, organization: row.organization_id, principal: row.principal_id, status: row.status, client: row.client }) : null;
  }
  async delegationPermissions(context: ReadTransactionContext, roles: readonly string[]): Promise<readonly DelegationPermission[]> {
    const database = this.transactions.database(context);
    const result = await database.query<DelegationPermissionRow>(
      `select role.id role_id,role.version role_version,
      permission.code,mapping.effect from access.role role join access.rolepermission mapping on mapping.role_id=role.id
      join access.permission permission on permission.id=mapping.permission_id and permission.status='active'
      where role.id=any($1::text[]) order by permission.code,mapping.effect,role.id`,
      [roles]
    );
    return Object.freeze(result.rows.map((row) => Object.freeze({ role: row.role_id, roleVersion: Number(row.role_version), code: row.code, effect: row.effect })));
  }
  async delegationScopes(context: ReadTransactionContext, membership: string): Promise<readonly DelegationScope[]> {
    const database = this.transactions.database(context);
    const result = await database.query<DelegationScopeRow>(
      `select id,scope_kind,scope_id,scope_path,effect,access_version,
      effective_at,expires_at from access.scopegrant where membership_id=$1 and effective_at<=clock_timestamp()
      and (expires_at is null or expires_at>clock_timestamp()) order by scope_kind,scope_id,effect,id`,
      [membership]
    );
    return Object.freeze(result.rows.map(delegationScope));
  }
  async campaignRoles(context: ReadTransactionContext): Promise<readonly DelegationRole[]> {
    const database = this.transactions.database(context);
    const result = await database.query<DelegationRoleRow>(`select id,version,kind,null::timestamptz expires_at from access.role
      where id in('role-zhudatuan-storefront-member','role:self') and status='active' order by id`);
    return Object.freeze(result.rows.map(delegationRole));
  }
  async delegationRoles(context: ReadTransactionContext, membership: string): Promise<readonly DelegationRole[]> {
    const database = this.transactions.database(context);
    const result = await database.query<DelegationRoleRow>(
      `select role.id,role.version,role.kind,assignment.expires_at
      from access.membershiprole assignment join access.role role on role.id=assignment.role_id and role.status='active'
      where assignment.membership_id=$1 and assignment.effective_at<=clock_timestamp()
        and (assignment.expires_at is null or assignment.expires_at>clock_timestamp()) order by role.id
        `,
      [membership]
    );
    return Object.freeze(result.rows.map(delegationRole));
  }
}
