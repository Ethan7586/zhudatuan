import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { DelegationIssuer, DelegationPermission, DelegationRole, DelegationScope, DelegationTarget, Ownership, VersionChange } from '../../application/port/AccessRepository';
import type { OwnerCandidate, OwnerIdentity, OwnershipMember, OwnershipRepository, OwnershipTransferView, OwnershipView } from '../../application/port/OwnershipRepository';
import type { Membership } from '../../domain/model/Membership';
import { OwnershipTransfer } from '../../domain/model/OwnershipTransfer';
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
import { PgRuntimeWriter } from '../../../../adapter/database/PgRuntimeWriter';
import type { SqlExecutor } from '../../../../adapter/database/PgTransactionAccess';

interface OwnershipViewRow {
  readonly version: number;
  readonly mobile_ready: boolean;
  readonly owner: OwnerIdentity;
  readonly candidates: OwnerCandidate[];
  readonly former_owner_roles: Array<{ id: string; name: string; version: number }>;
  readonly pending: OwnershipTransferView | null;
}

interface TransferRow {
  readonly id: string;
  readonly scope_id: string;
  readonly role_id: string;
  readonly source_membership_id: string;
  readonly target_membership_id: string;
  readonly former_owner_mode: 'retain_admin' | 'remove_admin';
  readonly former_owner_role_id: string | null;
  readonly former_owner_role_version: number | null;
  readonly ownership_version: number;
  readonly target_access_version: number;
  readonly source_proof_hash: string | null;
  readonly target_proof_hash: string | null;
  readonly cancel_proof_hash: string | null;
  readonly state: 'draft' | 'pending' | 'accepted' | 'cancelled' | 'expired';
  readonly version: number;
  readonly cooling_until: Date;
  readonly expires_at: Date;
}

export class PgAccessGovernanceRepository extends PgEmployeeAccessRepository implements OwnershipRepository {
  async read(context: ReadTransactionContext, scope: string, membership: string): Promise<OwnershipView | null> {
    const result = await this.transactions.database(context).query<OwnershipViewRow>(
      `select ownership.version,
      ownerprofile.mobile_masked is not null mobile_ready,
      jsonb_build_object('membership',owner.id,'member',owner.member_id,'principal',owner.principal_id,
        'displayName',coalesce(ownerprofile.display_name,owner.id)) owner,
      coalesce((select jsonb_agg(jsonb_build_object(
        'membership',candidate.id,'member',candidate.member_id,'principal',candidate.principal_id,
        'displayName',coalesce(profile.display_name,candidate.id),'mobileReady',profile.mobile_masked is not null,
        'accessVersion',candidate.access_version,'roles',coalesce(roles.names,'[]'::jsonb))
        order by coalesce(profile.display_name,candidate.id),candidate.id)
        from access.membership candidate
        left join access.memberprofile profile on profile.member_id=candidate.member_id
        left join lateral(select jsonb_agg(role.name order by role.name) names
          from access.membershiprole assignment join access.role role on role.id=assignment.role_id
          where assignment.membership_id=candidate.id and role.kind<>'owner' and role.status='active'
            and assignment.effective_at<=clock_timestamp() and (assignment.expires_at is null or assignment.expires_at>clock_timestamp())) roles on true
        where candidate.organization_id=ownership.scope_id and candidate.status='active'
          and case candidate.client when 'operator' then 'console' else candidate.client end='console'
          and candidate.id<>ownership.membership_id),'[]'::jsonb) candidates,
      coalesce((select jsonb_agg(jsonb_build_object('id',role.id,'name',role.name,'version',role.version) order by role.name,role.id)
        from access.role role where role.scope_id=ownership.scope_id and role.status='active' and role.kind<>'owner'),'[]'::jsonb) former_owner_roles,
      (select jsonb_build_object('id',transfer.id,
        'state',case when transfer.state='pending' and transfer.expires_at<=clock_timestamp() then 'expired' else transfer.state end,
        'sourceMembership',transfer.source_membership_id,'targetMembership',transfer.target_membership_id,
        'targetMember',target.member_id,'targetPrincipal',target.principal_id,
        'targetDisplayName',coalesce(targetprofile.display_name,target.id),'formerOwnerMode',transfer.former_owner_mode,
        'formerOwnerRole',transfer.former_owner_role_id,'formerOwnerRoleVersion',transfer.former_owner_role_version,
        'coolingUntil',transfer.cooling_until,
        'expiresAt',transfer.expires_at,'version',transfer.version)
        from access.ownershiptransfer transfer join access.membership target on target.id=transfer.target_membership_id
        left join access.memberprofile targetprofile on targetprofile.member_id=target.member_id
        where transfer.scope_id=ownership.scope_id and transfer.state='pending'
          and (transfer.source_membership_id=$2 or transfer.target_membership_id=$2)
        order by transfer.created_at desc limit 1) pending
      from access.ownership ownership join access.membership owner on owner.id=ownership.membership_id
      left join access.memberprofile ownerprofile on ownerprofile.member_id=owner.member_id
      where ownership.scope_id=$1 and access.scope_allowed(ownership.scope_id)`,
      [scope, membership]
    );
    const row = result.rows[0];
    return row
      ? Object.freeze({ state: 'active', version: Number(row.version), mobileReady: row.mobile_ready, owner: Object.freeze(row.owner), candidates: row.candidates, formerOwnerRoles: row.former_owner_roles, pending: row.pending ? Object.freeze(row.pending) : null })
      : null;
  }

  async lockMembers(context: WriteTransactionContext, memberships: readonly string[]): Promise<readonly OwnershipMember[]> {
    const result = await this.transactions.database(context).query<MembershipRow & { readonly mobile_ready: boolean }>(
      `select membership.id,membership.organization_id,membership.client,membership.status,membership.access_version,
      profile.mobile_masked is not null mobile_ready
      from access.membership membership left join access.memberprofile profile on profile.member_id=membership.member_id
      where membership.id=any($1::text[]) order by membership.id for update of membership`,
      [memberships]
    );
    return Object.freeze(result.rows.map((row) => Object.freeze({
      id: row.id,
      organization: row.organization_id,
      client: row.client === 'operator' ? 'console' : row.client,
      status: row.status,
      accessVersion: Number(row.access_version),
      mobileReady: row.mobile_ready,
    } as OwnershipMember)));
  }

  async roleVersion(context: ReadTransactionContext, role: string | null, scope: string): Promise<number | null> {
    if (role === null) return null;
    const result = await this.transactions.database(context).query<{ version: number }>(
      `select version from access.role where id=$1 and scope_id=$2 and status='active' and kind<>'owner'`,
      [role, scope]
    );
    return result.rows[0] ? Number(result.rows[0].version) : null;
  }

  async impact(context: ReadTransactionContext, scope: string, memberships: readonly string[]): Promise<Readonly<{ people: number; scopes: number }>> {
    const result = await this.transactions.database(context).query<{ people: number; scopes: number }>(
      `select count(distinct membership.id)::integer people,
      count(distinct (grantrow.scope_kind,grantrow.scope_id))::integer scopes
      from access.membership membership left join access.scopegrant grantrow on grantrow.membership_id=membership.id
        and grantrow.effective_at<=clock_timestamp() and (grantrow.expires_at is null or grantrow.expires_at>clock_timestamp())
      where membership.id=any($1::text[]) and membership.organization_id=$2 and access.scope_allowed($2)`,
      [memberships, scope]
    );
    return Object.freeze({ people: Number(result.rows[0]?.people ?? 0), scopes: Number(result.rows[0]?.scopes ?? 0) });
  }

  async activeTransfer(context: WriteTransactionContext, scope: string, trace: string): Promise<boolean> {
    const database = this.transactions.database(context);
    const result = await database.query<{
      active: boolean;
      expired: Array<{ id: string; tenant: string; scope: string; sourceMembership: string; targetMembership: string; version: number }>;
    }>(
      `with expired as (
        update access.ownershiptransfer set state='expired',version=version+1,expired_at=clock_timestamp(),
          updated_by=current_setting('app.membership_id'),updated_at=clock_timestamp()
        where scope_id=$1 and state='pending' and expires_at<=clock_timestamp()
        returning id,tenant_id,scope_id,source_membership_id,target_membership_id,version
      ), recorded as (
        insert into access.ownershiptimeline(id,tenant_id,scope_id,transfer_id,previous_state,state,actor_membership_id,reason,version,occurred_at)
        select 'ownershiptimeline:'||gen_random_uuid(),tenant_id,scope_id,id,'pending','expired',source_membership_id,'acceptancetimeout',version,clock_timestamp()
        from expired returning id
      ) select exists(select 1 from access.ownershiptransfer where scope_id=$1 and state='pending' and expires_at>clock_timestamp()) active,
        coalesce((select jsonb_agg(jsonb_build_object('id',id,'tenant',tenant_id,'scope',scope_id,
          'sourceMembership',source_membership_id,'targetMembership',target_membership_id,'version',version) order by id)
          from expired),'[]'::jsonb) expired`,
      [scope]
    );
    const row = result.rows[0];
    const runtime = new PgRuntimeWriter(database);
    for (const expired of row?.expired ?? []) {
      await runtime.append({
        id: `event:${randomUUID()}`,
        type: 'access.owner.transfer.expired',
        aggregateType: 'ownershiptransfer',
        aggregate: expired.id,
        scope: expired.scope,
        payload: { transfer: expired.id, scope: expired.scope, sourceMembership: expired.sourceMembership, targetMembership: expired.targetMembership, version: Number(expired.version) },
        trace,
      });
    }
    return row?.active ?? false;
  }

  async create(context: WriteTransactionContext, transfer: OwnershipTransfer, reason: string, actor: string, trace: string): Promise<OwnershipTransferView | null> {
    const database = this.transactions.database(context);
    if (transfer.sourceProof === null || transfer.state !== 'pending') return null;
    const proof = `ownershipproof:${randomUUID()}`;
    const result = await database.query(
      `with proof as (
        insert into access.ownershipproof(id,tenant_id,scope_id,transfer_id,stage,actor_membership_id,token_hash,consumed_at,created_at)
        values($1,current_setting('app.tenant_id'),$2,$3,'source',$4,decode($5,'hex'),clock_timestamp(),clock_timestamp()) returning id
      ) insert into access.ownershiptransfer(id,tenant_id,scope_id,role_id,source_membership_id,target_membership_id,
        former_owner_mode,former_owner_role_id,former_owner_role_version,ownership_version,target_access_version,source_proof_id,state,reason,version,
        cooling_until,expires_at,created_by,updated_by,created_at,updated_at)
      select $3,current_setting('app.tenant_id'),$2,$6,$4,$7,$8,$9,$10,$11,$12,proof.id,'pending',$13,$14,$15,$16,$17,$17,clock_timestamp(),clock_timestamp()
      from proof where not exists(select 1 from access.ownershiptransfer active where active.scope_id=$2
        and active.state='pending' and active.expires_at>clock_timestamp())
      returning id`,
      [proof, transfer.scope, transfer.id, transfer.sourceMembership, transfer.sourceProof, transfer.role, transfer.targetMembership, transfer.formerOwnerMode, transfer.formerOwnerRole, transfer.formerOwnerRoleVersion, transfer.ownershipVersion, transfer.targetAccessVersion, reason, transfer.version, transfer.coolingUntil, transfer.expiresAt, actor]
    );
    if (!result.rows[0]) return null;
    await this.timeline(database, transfer.id, transfer.scope, 'draft', 'pending', actor, reason, transfer.version);
    await new PgRuntimeWriter(database).schedule({
      id: `job:ownershipexpiry:${transfer.id}`,
      kind: 'ownershipexpiry',
      owner: 'access',
      scope: transfer.scope,
      payload: { transfer: transfer.id, scope: transfer.scope, traceId: trace },
      priority: 90,
      availableAt: transfer.expiresAt.toISOString(),
    });
    return this.transferView(database, transfer.scope, transfer.id);
  }

  async lockTransfer(context: WriteTransactionContext, scope: string, transfer: string): Promise<OwnershipTransfer | null> {
    const result = await this.transactions.database(context).query<TransferRow>(
      `select candidate.id,candidate.scope_id,candidate.role_id,candidate.source_membership_id,candidate.target_membership_id,
      candidate.former_owner_mode,candidate.former_owner_role_id,candidate.former_owner_role_version,candidate.ownership_version,candidate.target_access_version,
      encode(source.token_hash,'hex') source_proof_hash,encode(target.token_hash,'hex') target_proof_hash,
      encode(cancel.token_hash,'hex') cancel_proof_hash,
      candidate.state,candidate.version,candidate.cooling_until,candidate.expires_at
      from access.ownershiptransfer candidate
      left join access.ownershipproof source on source.id=candidate.source_proof_id
      left join access.ownershipproof target on target.id=candidate.target_proof_id
      left join access.ownershipproof cancel on cancel.id=candidate.cancel_proof_id
      where candidate.id=$1 and candidate.scope_id=$2 and access.scope_allowed(candidate.scope_id) for update of candidate`,
      [transfer, scope]
    );
    const row = result.rows[0];
    return row ? transferModel(row) : null;
  }

  async accept(context: WriteTransactionContext, transfer: OwnershipTransfer, actor: string): Promise<Readonly<{ ownership: OwnershipView; transfer: OwnershipTransferView }> | null> {
    const database = this.transactions.database(context);
    if (transfer.targetProof === null || transfer.state !== 'accepted') return null;
    const proof = `ownershipproof:${randomUUID()}`;
    const previousVersion = transfer.version - 1;
    const inserted = await database.query(
      `with proof as (
        insert into access.ownershipproof(id,tenant_id,scope_id,transfer_id,stage,actor_membership_id,token_hash,consumed_at,created_at)
        values($1,current_setting('app.tenant_id'),$2,$3,'target',$4,decode($5,'hex'),clock_timestamp(),clock_timestamp()) returning id
      ) update access.ownershiptransfer changed set state='accepted',target_proof_id=proof.id,version=$6,
        accepted_at=clock_timestamp(),updated_by=$4,updated_at=clock_timestamp()
      from proof where changed.id=$3 and changed.scope_id=$2 and changed.state='pending' and changed.version=$7
        and changed.cooling_until<=clock_timestamp() and changed.expires_at>clock_timestamp()
        and changed.source_membership_id<>$4 and changed.target_membership_id=$4
      returning changed.id`,
      [proof, transfer.scope, transfer.id, actor, transfer.targetProof, transfer.version, previousVersion]
    );
    if (!inserted.rows[0]) return null;
    const expired = await database.query(
      `update access.membershiprole set expires_at=clock_timestamp()
      where membership_id=$1 and role_id=$2 and effective_at<=clock_timestamp()
        and (expires_at is null or expires_at>clock_timestamp()) returning membership_id`,
      [transfer.sourceMembership, transfer.role]
    );
    if (expired.rows.length !== 1) throw new Error('OWNER_ROLE_SOURCE_INVALID');
    if (transfer.formerOwnerMode === 'retain_admin' && transfer.formerOwnerRole !== null) {
      const retained = await database.query(
        `insert into access.membershiprole(membership_id,role_id,effective_at,delegated_by)
        select $1,id,clock_timestamp(),$3 from access.role
        where id=$2 and scope_id=$4 and status='active' and kind<>'owner' and version=$5
        returning membership_id`,
        [transfer.sourceMembership, transfer.formerOwnerRole, actor, transfer.scope, transfer.formerOwnerRoleVersion]
      );
      if (retained.rows.length !== 1) throw new Error('FORMER_OWNER_ROLE_VERSION_CONFLICT');
    }
    if (transfer.formerOwnerMode === 'remove_admin') {
      await database.query(
        `update access.membershiprole set expires_at=clock_timestamp()
        where membership_id=$1 and effective_at<=clock_timestamp()
          and (expires_at is null or expires_at>clock_timestamp())`,
        [transfer.sourceMembership]
      );
      await database.query(
        `update access.scopegrant set expires_at=clock_timestamp()
        where membership_id=$1 and scope_kind<>'self' and effective_at<=clock_timestamp()
          and (expires_at is null or expires_at>clock_timestamp())`,
        [transfer.sourceMembership]
      );
      await database.query(
        `update access.membershipoverride set revoked_at=clock_timestamp()
        where membership_id=$1 and revoked_at is null and effective_at<=clock_timestamp()
          and (expires_at is null or expires_at>clock_timestamp())`,
        [transfer.sourceMembership]
      );
    }
    await database.query(
      `insert into access.membershiprole(membership_id,role_id,effective_at,delegated_by)
      values($1,$2,clock_timestamp(),$3)`,
      [transfer.targetMembership, transfer.role, actor]
    );
    const owner = await database.query(
      `update access.ownership set membership_id=$2,version=version+1,updated_at=clock_timestamp()
      where scope_id=$1 and membership_id=$3 and version=$4 returning version`,
      [transfer.scope, transfer.targetMembership, transfer.sourceMembership, transfer.ownershipVersion]
    );
    if (!owner.rows[0]) throw new Error('OWNERSHIP_VERSION_CONFLICT');
    await database.query(
      `update access.membership set access_version=access_version+1,
      status=case when id=$2 and $3='remove_admin' then 'suspended' else status end
      where id=any($1::text[]) and status='active'`,
      [[transfer.sourceMembership, transfer.targetMembership], transfer.sourceMembership, transfer.formerOwnerMode]
    );
    await this.timeline(database, transfer.id, transfer.scope, 'pending', 'accepted', actor, 'targetaccepted', transfer.version);
    const view = await this.read(context, transfer.scope, actor);
    const changed = await this.transferView(database, transfer.scope, transfer.id);
    return view && changed ? Object.freeze({ ownership: view, transfer: changed }) : null;
  }

  async cancel(context: WriteTransactionContext, transfer: OwnershipTransfer, reason: string, actor: string): Promise<OwnershipTransferView | null> {
    const database = this.transactions.database(context);
    if (transfer.state !== 'cancelled') return null;
    if (transfer.cancelProof === null) return null;
    const proof = `ownershipproof:${randomUUID()}`;
    const result = await database.query(
      `with proof as (
        insert into access.ownershipproof(id,tenant_id,scope_id,transfer_id,stage,actor_membership_id,token_hash,consumed_at,created_at)
        values($1,current_setting('app.tenant_id'),$2,$3,'cancel',$4,decode($5,'hex'),clock_timestamp(),clock_timestamp()) returning id
      ) update access.ownershiptransfer changed set state='cancelled',cancel_proof_id=proof.id,cancellation_reason=$6,
        version=$7,cancelled_at=clock_timestamp(),updated_by=$4,updated_at=clock_timestamp()
      from proof where changed.id=$3 and changed.scope_id=$2 and changed.state='pending' and changed.version=$8
        and changed.source_membership_id=$4 and changed.expires_at>clock_timestamp() returning changed.id`,
      [proof, transfer.scope, transfer.id, actor, transfer.cancelProof, reason, transfer.version, transfer.version - 1]
    );
    if (!result.rows[0]) return null;
    await this.timeline(database, transfer.id, transfer.scope, 'pending', 'cancelled', actor, reason, transfer.version);
    return this.transferView(database, transfer.scope, transfer.id);
  }

  async expire(context: WriteTransactionContext, scope: string, transfer: string, trace: string): Promise<boolean> {
    const database = this.transactions.database(context);
    const result = await database.query<{ id: string; source_membership_id: string; target_membership_id: string; version: number }>(
      `update access.ownershiptransfer set state='expired',version=version+1,expired_at=clock_timestamp(),
      updated_by='job:ownershipexpiry',updated_at=clock_timestamp()
      where id=$1 and scope_id=$2 and state='pending' and expires_at<=clock_timestamp()
      returning id,source_membership_id,target_membership_id,version`,
      [transfer, scope]
    );
    const changed = result.rows[0];
    if (!changed) return false;
    await this.timeline(database, changed.id, scope, 'pending', 'expired', 'job:ownershipexpiry', 'acceptancetimeout', Number(changed.version));
    await new PgRuntimeWriter(database).append({
      id: `event:${randomUUID()}`,
      type: 'access.owner.transfer.expired',
      aggregateType: 'ownershiptransfer',
      aggregate: changed.id,
      scope,
      payload: { transfer: changed.id, scope, sourceMembership: changed.source_membership_id, targetMembership: changed.target_membership_id, version: Number(changed.version) },
      trace,
    });
    return true;
  }

  private async transferView(database: SqlExecutor, scope: string, transfer: string): Promise<OwnershipTransferView | null> {
    const result = await database.query<OwnershipTransferView>(
      `select candidate.id,candidate.state,candidate.source_membership_id "sourceMembership",
      candidate.target_membership_id "targetMembership",target.member_id "targetMember",target.principal_id "targetPrincipal",
      coalesce(profile.display_name,target.id) "targetDisplayName",candidate.former_owner_mode "formerOwnerMode",
      candidate.former_owner_role_id "formerOwnerRole",candidate.former_owner_role_version "formerOwnerRoleVersion",
      candidate.cooling_until "coolingUntil",
      candidate.expires_at "expiresAt",candidate.version
      from access.ownershiptransfer candidate join access.membership target on target.id=candidate.target_membership_id
      left join access.memberprofile profile on profile.member_id=target.member_id
      where candidate.id=$1 and candidate.scope_id=$2`,
      [transfer, scope]
    );
    const row = result.rows[0];
    return row ? Object.freeze({ ...row, version: Number(row.version), coolingUntil: new Date(row.coolingUntil).toISOString(), expiresAt: new Date(row.expiresAt).toISOString() }) : null;
  }

  private async timeline(database: SqlExecutor, transfer: string, scope: string, previous: string | null, state: string, actor: string, reason: string, version: number): Promise<void> {
    await database.query(
      `insert into access.ownershiptimeline(id,tenant_id,scope_id,transfer_id,previous_state,state,actor_membership_id,reason,version,occurred_at)
      values($1,current_setting('app.tenant_id'),$2,$3,$4,$5,$6,$7,$8,clock_timestamp())`,
      [`ownershiptimeline:${randomUUID()}`, scope, transfer, previous, state, actor, reason, version]
    );
  }
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

function transferModel(row: TransferRow): OwnershipTransfer {
  return new OwnershipTransfer({
    id: row.id,
    scope: row.scope_id,
    role: row.role_id,
    sourceMembership: row.source_membership_id,
    targetMembership: row.target_membership_id,
    formerOwnerMode: row.former_owner_mode,
    formerOwnerRole: row.former_owner_role_id,
    formerOwnerRoleVersion: row.former_owner_role_version === null ? null : Number(row.former_owner_role_version),
    ownershipVersion: Number(row.ownership_version),
    targetAccessVersion: Number(row.target_access_version),
    sourceProof: row.source_proof_hash,
    targetProof: row.target_proof_hash,
    cancelProof: row.cancel_proof_hash,
    state: row.state,
    version: Number(row.version),
    coolingUntil: row.cooling_until,
    expiresAt: row.expires_at,
  });
}
