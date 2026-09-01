import { PgTransactionAccess } from '../../../../adapter/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { DelegationIssuer, DelegationPermission, DelegationRole, DelegationScope, DelegationTarget, Ownership, VersionChange } from '../../application/port/AccessRepository';
import type { Membership } from '../../domain/model/Membership';
import { PgAccessMembershipRepository } from './PgAccessMembershipRepository';
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
import { PgRuntimeWriter } from '../../../../adapter/database/PgRuntimeWriter';
export class PgAccessGovernanceRepository extends PgAccessMembershipRepository {
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
  async expireRole(context: WriteTransactionContext, membership: string, role: string): Promise<boolean> {
    const database = this.transactions.database(context);
    const result = await database.query(
      `update access.membershiprole set expires_at=clock_timestamp()
      where membership_id=$1 and role_id=$2 and effective_at<=clock_timestamp()
        and (expires_at is null or expires_at>clock_timestamp()) returning membership_id`,
      [membership, role]
    );
    return result.rows.length === 1;
  }
  async assignRole(
    context: WriteTransactionContext,
    input: Readonly<{
      membership: string;
      role: string;
      issuer: string;
    }>
  ): Promise<void> {
    const database = this.transactions.database(context);
    await database.query(
      `insert into access.membershiprole(membership_id,role_id,effective_at,delegated_by)
      values($1,$2,clock_timestamp(),$3)`,
      [input.membership, input.role, input.issuer]
    );
  }
  async transferOwnership(
    context: WriteTransactionContext,
    input: Readonly<{
      scope: string;
      membership: string;
      expectedVersion: number;
    }>
  ): Promise<boolean> {
    const database = this.transactions.database(context);
    const result = await database.query(
      `update access.ownership set membership_id=$2,version=version+1,
      updated_at=clock_timestamp() where scope_id=$1 and version=$3 returning scope_id`,
      [input.scope, input.membership, input.expectedVersion]
    );
    return result.rows.length === 1;
  }
  async ownerTransferred(
    context: WriteTransactionContext,
    input: Readonly<{
      scope: string;
      previous: string;
      membership: string;
      version: number;
      trace: string;
    }>
  ): Promise<void> {
    const database = this.transactions.database(context);
    await new PgRuntimeWriter(database).append({
      id: `event:${randomUUID()}`,
      type: 'access.owner.transferred',
      aggregateType: 'ownership',
      aggregate: input.scope,
      scope: input.scope,
      payload: { scope: input.scope, previousMembership: input.previous, membership: input.membership, version: input.version },
      trace: input.trace,
    });
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
  async createCampaignMembership(
    context: WriteTransactionContext,
    input: Readonly<{
      membership: string;
      member: string;
      principal: string;
      organization: string;
      issuer: string;
      mallGrant: string;
      ownerGrant: string;
      selfGrant: string;
    }>
  ): Promise<void> {
    const database = this.transactions.database(context);
    const created = await database.query(
      `insert into access.membership(id,member_id,principal_id,organization_id,client,status,
      access_version) values($1,$2,$3,$4,'storefront','invited',1) returning id`,
      [input.membership, input.member, input.principal, input.organization]
    );
    if (!created.rows[0]) throw new Error('MEMBERSHIP_CREATE_FAILED');
    await database.query(
      `insert into access.membershiprole(membership_id,role_id,effective_at,delegated_by) values
      ($1,'role-zhudatuan-storefront-member',clock_timestamp(),$2),($1,'role:self',clock_timestamp(),$2)`,
      [input.membership, input.issuer]
    );
    await database.query(
      `insert into access.scopegrant(id,membership_id,scope_kind,scope_id,scope_path,effect,effective_at,
      access_version) values($1,$2,'mall',$3,$3,'allow',clock_timestamp(),1),
      ($4,$2,'owner',$5,$5,'allow',clock_timestamp(),1),($6,$2,'self',$7,$7,'allow',clock_timestamp(),1)`,
      [input.mallGrant, input.membership, input.organization, input.ownerGrant, input.member, input.selfGrant, `self:${input.principal}`]
    );
  }
  async pendingMember(context: ReadTransactionContext, membership: string): Promise<string | null> {
    const database = this.transactions.database(context);
    const result = await database.query<{
      member_id: string;
    }>(
      `select member_id from access.membership
      where id=$1 and status='invited'`,
      [membership]
    );
    return result.rows[0]?.member_id ?? null;
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
