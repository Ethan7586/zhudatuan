import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
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

export class PgAccessGovernanceRepository extends PgAccessMembershipRepository {
  async lockOwnership(database: OperationDatabase, scope: string): Promise<Ownership | null> {
    const result = await database.query<OwnershipRow>(
      `select ownership.scope_id,ownership.role_id,
      ownership.membership_id,ownership.version,role.kind role_kind from access.ownership ownership
      join access.role role on role.id=ownership.role_id where ownership.scope_id=$1 for update of ownership,role`,
      [scope]
    );
    const row = result.rows[0];
    return row ? Object.freeze({ scope: row.scope_id, role: row.role_id, membership: row.membership_id, version: Number(row.version), roleKind: row.role_kind }) : null;
  }

  async lockMemberships(database: OperationDatabase, memberships: readonly string[]): Promise<readonly Membership[]> {
    const result = await database.query<MembershipRow>(
      `select id,organization_id,client,status,access_version
      from access.membership where id=any($1::text[]) order by id for update`,
      [memberships]
    );
    return Object.freeze(result.rows.map(membershipModel));
  }

  async expireRole(database: OperationDatabase, membership: string, role: string): Promise<boolean> {
    const result = await database.query(
      `update access.membershiprole set expires_at=clock_timestamp()
      where membership_id=$1 and role_id=$2 and effective_at<=clock_timestamp()
        and (expires_at is null or expires_at>clock_timestamp()) returning membership_id`,
      [membership, role]
    );
    return result.rows.length === 1;
  }

  async assignRole(database: OperationDatabase, input: Readonly<{ membership: string; role: string; issuer: string }>): Promise<void> {
    await database.query(
      `insert into access.membershiprole(membership_id,role_id,effective_at,delegated_by)
      values($1,$2,clock_timestamp(),$3)`,
      [input.membership, input.role, input.issuer]
    );
  }

  async transferOwnership(database: OperationDatabase, input: Readonly<{ scope: string; membership: string; expectedVersion: number }>): Promise<boolean> {
    const result = await database.query(
      `update access.ownership set membership_id=$2,version=version+1,
      updated_at=clock_timestamp() where scope_id=$1 and version=$3 returning scope_id`,
      [input.scope, input.membership, input.expectedVersion]
    );
    return result.rows.length === 1;
  }

  async ownerTransferred(database: OperationDatabase, input: Readonly<{ scope: string; previous: string; membership: string; version: number; trace: string }>): Promise<void> {
    await database.query(
      `insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,
      trace_id,occurred_at,available_at) values('event:'||gen_random_uuid(),'access.owner.transferred',1,'ownership',$1,$1,
      jsonb_build_object('scope',$1::text,'previousMembership',$2::text,'membership',$3::text,'version',$4::bigint),$5,clock_timestamp(),clock_timestamp())`,
      [input.scope, input.previous, input.membership, input.version, input.trace]
    );
  }

  async incrementVersion(database: OperationDatabase, membership: string): Promise<VersionChange | null> {
    const result = await database.query<VersionRow>(
      `update access.membership set access_version=access_version+1
      where id=$1 returning id membership_id,organization_id,access_version`,
      [membership]
    );
    return versionChange(result.rows[0]);
  }

  async incrementRoleVersions(database: OperationDatabase, role: string): Promise<readonly VersionChange[]> {
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

  async activate(database: OperationDatabase, membership: string): Promise<VersionChange | null> {
    const result = await database.query<VersionRow>(
      `update access.membership
      set status='active',access_version=access_version+1,joined_at=coalesce(joined_at,clock_timestamp())
      where id=$1 and status='invited' returning id membership_id,organization_id,access_version`,
      [membership]
    );
    return versionChange(result.rows[0]);
  }

  async versionChanged(database: OperationDatabase, changes: readonly VersionChange[], reason: string, trace: string): Promise<void> {
    if (changes.length === 0) return;
    await database.query(
      `insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,
      trace_id,occurred_at,available_at)
      select 'event:'||gen_random_uuid(),'access.version.changed',1,'membership',changed.membership,changed.scope,
        jsonb_build_object('membership',changed.membership,'version',changed.version,'reason',$2::text),$3,clock_timestamp(),clock_timestamp()
      from jsonb_to_recordset($1::jsonb) changed(membership text,scope text,version bigint)`,
      [JSON.stringify(changes.map((row) => ({ membership: row.membership, scope: row.organization, version: row.version }))), reason, trace]
    );
  }

  async membershipActivated(database: OperationDatabase, input: Readonly<{ change: VersionChange; invitation: string; target: 'storefront'; grantDigest: string; trace: string }>): Promise<void> {
    await database.query(
      `insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,
      trace_id,occurred_at,available_at) values('event:'||gen_random_uuid(),'access.membership.activated',1,'membership',$1,$2,
      jsonb_build_object('membershipId',$1::text,'accessVersion',$3::bigint,'invitationId',$5::text,'target',$6::text,'grantDigest',$7::text),
      $4,clock_timestamp(),clock_timestamp())`,
      [input.change.membership, input.change.organization, input.change.version, input.trace, input.invitation, input.target, input.grantDigest]
    );
  }

  async createCampaignMembership(
    database: OperationDatabase,
    input: Readonly<{ membership: string; member: string; principal: string; organization: string; issuer: string; mallGrant: string; ownerGrant: string; selfGrant: string }>
  ): Promise<void> {
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

  async pendingMember(database: OperationDatabase, membership: string): Promise<string | null> {
    const result = await database.query<{ member_id: string }>(
      `select member_id from access.membership
      where id=$1 and status='invited' for update`,
      [membership]
    );
    return result.rows[0]?.member_id ?? null;
  }

  async lockDelegationIssuer(database: OperationDatabase, membership: string): Promise<DelegationIssuer | null> {
    const result = await database.query<IssuerRow>(
      `select organization_id,access_version from access.membership
      where id=$1 and status='active' for update`,
      [membership]
    );
    const row = result.rows[0];
    return row ? Object.freeze({ organization: row.organization_id, accessVersion: Number(row.access_version) }) : null;
  }

  async delegationTarget(database: OperationDatabase, membership: string): Promise<DelegationTarget | null> {
    const result = await database.query<TargetRow>(
      `select id,organization_id,principal_id,status,client
      from access.membership where id=$1 for share`,
      [membership]
    );
    const row = result.rows[0];
    return row ? Object.freeze({ id: row.id, organization: row.organization_id, principal: row.principal_id, status: row.status, client: row.client }) : null;
  }

  async delegationPermissions(database: OperationDatabase, roles: readonly string[]): Promise<readonly DelegationPermission[]> {
    const result = await database.query<DelegationPermissionRow>(
      `select role.id role_id,role.version role_version,
      permission.code,mapping.effect from access.role role join access.rolepermission mapping on mapping.role_id=role.id
      join access.permission permission on permission.id=mapping.permission_id and permission.status='active'
      where role.id=any($1::text[]) order by permission.code,mapping.effect,role.id`,
      [roles]
    );
    return Object.freeze(result.rows.map((row) => Object.freeze({ role: row.role_id, roleVersion: Number(row.role_version), code: row.code, effect: row.effect })));
  }

  async delegationScopes(database: OperationDatabase, membership: string): Promise<readonly DelegationScope[]> {
    const result = await database.query<DelegationScopeRow>(
      `select id,scope_kind,scope_id,scope_path,effect,access_version,
      effective_at,expires_at from access.scopegrant where membership_id=$1 and effective_at<=clock_timestamp()
      and (expires_at is null or expires_at>clock_timestamp()) order by scope_kind,scope_id,effect,id for share`,
      [membership]
    );
    return Object.freeze(result.rows.map(delegationScope));
  }

  async campaignRoles(database: OperationDatabase): Promise<readonly DelegationRole[]> {
    const result = await database.query<DelegationRoleRow>(`select id,version,kind,null::timestamptz expires_at from access.role
      where id in('role-zhudatuan-storefront-member','role:self') and status='active' order by id`);
    return Object.freeze(result.rows.map(delegationRole));
  }

  async delegationRoles(database: OperationDatabase, membership: string): Promise<readonly DelegationRole[]> {
    const result = await database.query<DelegationRoleRow>(
      `select role.id,role.version,role.kind,assignment.expires_at
      from access.membershiprole assignment join access.role role on role.id=assignment.role_id and role.status='active'
      where assignment.membership_id=$1 and assignment.effective_at<=clock_timestamp()
        and (assignment.expires_at is null or assignment.expires_at>clock_timestamp()) order by role.id
        for share of assignment,role`,
      [membership]
    );
    return Object.freeze(result.rows.map(delegationRole));
  }
}
