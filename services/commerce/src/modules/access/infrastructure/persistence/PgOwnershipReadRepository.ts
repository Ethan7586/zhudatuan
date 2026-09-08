import type { ReadTransactionContext, WriteTransactionContext } from '../../../../platform/database/TransactionContext';
import type { OwnerCandidate, OwnerIdentity, OwnershipMember, OwnershipTransferView, OwnershipView } from '../../application/port/OwnershipRepository';
import type { MembershipRow } from './AccessRecord';
import { PgAccessDelegationRepository } from './PgAccessDelegationRepository';
import { randomUUID } from 'node:crypto';
import { PgRuntimeWriter } from '../../../../platform/database/PgRuntimeWriter';

interface OwnershipViewRow {
  readonly version: number;
  readonly mobile_ready: boolean;
  readonly owner: OwnerIdentity;
  readonly candidates: OwnerCandidate[];
  readonly former_owner_roles: Array<{ id: string; name: string; version: number }>;
  readonly pending: OwnershipTransferView | null;
}

export class PgOwnershipReadRepository extends PgAccessDelegationRepository {
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
      ? Object.freeze({
          state: 'active',
          version: Number(row.version),
          mobileReady: row.mobile_ready,
          owner: Object.freeze(row.owner),
          candidates: row.candidates,
          formerOwnerRoles: row.former_owner_roles,
          pending: row.pending ? Object.freeze(row.pending) : null,
        })
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
    return Object.freeze(
      result.rows.map((row) =>
        Object.freeze({
          id: row.id,
          organization: row.organization_id,
          client: row.client === 'operator' ? 'console' : row.client,
          status: row.status,
          accessVersion: Number(row.access_version),
          mobileReady: row.mobile_ready,
        } as OwnershipMember)
      )
    );
  }

  async roleVersion(context: ReadTransactionContext, role: string | null, scope: string): Promise<number | null> {
    if (role === null) return null;
    const result = await this.transactions.database(context).query<{ version: number }>(`select version from access.role where id=$1 and scope_id=$2 and status='active' and kind<>'owner'`, [role, scope]);
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
}
