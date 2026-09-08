import { PgTransactionAccess } from '../../../../platform/database/PgTransactionAccess';
import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type {
  AccessCenterRecord,
  AccessRepository,
  DelegationIssuer,
  DelegationPermission,
  DelegationRole,
  DelegationScope,
  DelegationTarget,
  OverrideChange,
  OverrideTarget,
  Ownership,
  RoleChange,
  RoleDirectoryRecord,
  VersionChange,
} from '../../application/port/AccessRepository';
import type { Membership } from '../../domain/model/Membership';
import type { Override } from '../../domain/model/Override';
import { Role, type PermissionEffect } from '../../domain/model/Role';
import type { Scope } from '../../domain/model/Scope';
import { PgAccessGovernanceRepository } from './PgAccessGovernanceRepository';
import { membershipModel, overrideChange, roleModel, scopeModel, type CenterRow, type MembershipRow, type OverrideRow, type OverrideTargetRow, type RoleRow, type ScopeRow } from './AccessRecord';
import { PgAccessRoleRepository } from './PgAccessRoleRepository';
export class PgAccessRepository extends PgAccessRoleRepository implements AccessRepository {
  async scopePath(context: ReadTransactionContext, scope: string, kind: string): Promise<string | null> {
    const database = this.transactions.database(context);
    const result = await database.query<{
      path: string;
    }>(
      `select (access.scope_object($1)->'path')::text path
      where access.scope_allowed($1) and access.scope_object($1)->>'kind'=$2`,
      [scope, kind]
    );
    return result.rows[0]?.path ?? null;
  }
  async grantScope(
    context: WriteTransactionContext,
    input: Readonly<{
      id: string;
      membership: string;
      kind: string;
      scope: string;
      path: string;
      effect: PermissionEffect;
      expiresAt: Date | null;
      expectedVersion: number;
    }>
  ): Promise<Scope | null> {
    const database = this.transactions.database(context);
    const result = await database.query<ScopeRow>(
      `insert into access.scopegrant(id,membership_id,scope_kind,scope_id,scope_path,
      effect,effective_at,expires_at,access_version)
      select $1,subject.id,$3,$4,$5,$6,clock_timestamp(),$7,subject.access_version+1
      from access.membership subject where subject.id=$2 and subject.status='active' and subject.access_version=$8
        and access.scope_allowed(subject.organization_id)
      on conflict(membership_id,scope_kind,scope_id) do update set id=excluded.id,scope_path=excluded.scope_path,
        effect=excluded.effect,effective_at=excluded.effective_at,expires_at=excluded.expires_at,
        access_version=excluded.access_version
      returning id,membership_id,scope_kind,scope_id,scope_path,effect,expires_at`,
      [input.id, input.membership, input.kind, input.scope, input.path, input.effect, input.expiresAt, input.expectedVersion]
    );
    const row = result.rows[0];
    return row ? scopeModel(row) : null;
  }
  async lockOverrideTarget(context: WriteTransactionContext, membership: string): Promise<OverrideTarget | null> {
    const database = this.transactions.database(context);
    const result = await database.query<OverrideTargetRow>(
      `select membership.id,membership.organization_id,membership.client,
      membership.status,membership.access_version,exists(select 1 from access.membershiprole assignment
        join access.role role on role.id=assignment.role_id where assignment.membership_id=membership.id
        and role.kind='owner' and role.status='active' and assignment.effective_at<=clock_timestamp()
        and (assignment.expires_at is null or assignment.expires_at>clock_timestamp())) owner
      from access.membership membership where membership.id=$1 and membership.status='active'
        and access.scope_allowed(membership.organization_id) for update`,
      [membership]
    );
    const row = result.rows[0];
    return row ? Object.freeze({ membership: membershipModel(row), owner: row.owner }) : null;
  }
  async setOverride(context: WriteTransactionContext, value: Override, issuer: string): Promise<OverrideChange | null> {
    const database = this.transactions.database(context);
    const result = await database.query<OverrideRow>(
      `insert into access.membershipoverride(membership_id,permission_id,effect,
        granted_by,reason,effective_at,expires_at,revoked_at)
      select $1,permission.id,$3,$4,$5,clock_timestamp(),$6,null from access.permission permission
      where permission.code=$2 and permission.status='active'
      on conflict(membership_id,permission_id) do update set effect=excluded.effect,granted_by=excluded.granted_by,
        reason=excluded.reason,effective_at=excluded.effective_at,expires_at=excluded.expires_at,revoked_at=null
      returning effect,expires_at`,
      [value.membership, value.permission, value.effect, issuer, value.reason, value.expiresat]
    );
    return overrideChange(result.rows[0]);
  }
  async revokeOverride(
    context: WriteTransactionContext,
    input: Readonly<{
      membership: string;
      permission: string;
      reason: string;
    }>
  ): Promise<OverrideChange | null> {
    const database = this.transactions.database(context);
    const result = await database.query<OverrideRow>(
      `update access.membershipoverride override set revoked_at=clock_timestamp(),
      reason=$3 where override.membership_id=$1 and override.permission_id=(select id from access.permission where code=$2)
        and override.revoked_at is null and override.effective_at<=clock_timestamp()
      returning override.effect,override.expires_at`,
      [input.membership, input.permission, input.reason]
    );
    return overrideChange(result.rows[0]);
  }
}
