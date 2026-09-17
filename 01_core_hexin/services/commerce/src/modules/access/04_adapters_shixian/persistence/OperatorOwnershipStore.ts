import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import type { FormerOwnerMode, OwnerActionProofPayload, OwnershipProofSnapshot, OwnershipTransferInput } from '../../02_domain_yewu/AccessOwnership';

export class OperatorOwnershipStore {
  async ownership(database: OperationDatabase, membership: string): Promise<Readonly<Record<string, unknown>>> {
    await this.settleExpired(database);
    const result = await database.query(`select owner.state,owner.version,
      coalesce(caller_profile.mobile_ciphertext is not null and caller_profile.mobile_token is not null,false) "mobileReady",
      case when owner.membership_id is null then null else jsonb_build_object(
        'membership',owner.membership_id,'member',owner_profile.id,'principal',owner_profile.principal_id,
        'displayName',owner_profile.display_name) end owner,
      case when owner.membership_id=$1 then coalesce((select jsonb_agg(jsonb_build_object(
        'membership',candidate.id,'member',profile.id,'principal',profile.principal_id,'displayName',profile.display_name,
        'mobileReady',profile.mobile_ciphertext is not null and profile.mobile_token is not null,
        'roles',coalesce((select jsonb_agg(role.name order by role.name) from access.membershiprole assignment
          join access.role role on role.id=assignment.role_id where assignment.membership_id=candidate.id
            and assignment.effective_at<=clock_timestamp() and (assignment.expires_at is null or assignment.expires_at>clock_timestamp())
            and role.id not in('role:self','role-platform-owner-successor-v1')),'[]'::jsonb),
        'accessVersion',candidate.access_version) order by profile.display_name,candidate.id)
        from access.membership candidate join member.profile profile on profile.id=candidate.member_id and profile.status='active'
        join identity.principal principal on principal.id=profile.principal_id and principal.status='active'
        where candidate.organization_id='tenant-zhudatuan' and candidate.client='operator' and candidate.status='active'
          and candidate.id<>owner.membership_id and candidate.id!~'^membership:temp-'
          and exists(select 1 from access.membershiprole selfrole where selfrole.membership_id=candidate.id
            and selfrole.role_id='role:self' and selfrole.effective_at<=clock_timestamp() and selfrole.expires_at is null)
          and exists(select 1 from access.scopegrant selfscope where selfscope.membership_id=candidate.id
            and selfscope.scope_kind='self' and selfscope.scope_id='self:'||profile.principal_id and selfscope.effect='allow'
            and selfscope.effective_at<=clock_timestamp() and selfscope.expires_at is null)
          and exists(select 1 from access.membershiprole assignment join access.role adminrole on adminrole.id=assignment.role_id
            and adminrole.scope_id='tenant-zhudatuan' and adminrole.status='active'
            join access.rolepermission mapping on mapping.role_id=adminrole.id and mapping.effect='allow'
            join access.permission permission on permission.id=mapping.permission_id and permission.status='active'
            where assignment.membership_id=candidate.id and assignment.effective_at<=clock_timestamp()
              and (assignment.expires_at is null or assignment.expires_at>clock_timestamp()+interval '7 days')
              and adminrole.id not in('role:self','role-platform-owner-v2','role-platform-owner-successor-v1','role-zhudatuan-pending-operator'))
          and not exists(select 1 from (values('access.center.read'),('identity.password.verify'),
            ('identity.mobile.challenge'),('identity.mobile.manage'),('identity.stepup.start'),
            ('identity.stepup.complete')) required(operation_id)
            where not exists(select 1 from capability.membership_operations(candidate.id) available
              where available.operation_id=required.operation_id))
        ),'[]'::jsonb) else '[]'::jsonb end candidates,
      case when owner.membership_id=$1 then coalesce((select jsonb_agg(jsonb_build_object(
        'id',role.id,'name',role.name,'version',role.version) order by role.name)
        from access.role role where role.scope_id='tenant-zhudatuan' and role.status='active'
          and role.id not in('role:self','role-platform-owner-v2','role-platform-owner-successor-v1','role-zhudatuan-pending-operator')
          and exists(select 1 from access.rolepermission mapping join access.permission permission on permission.id=mapping.permission_id
            where mapping.role_id=role.id and mapping.effect='allow' and permission.status='active')),'[]'::jsonb) else '[]'::jsonb end "formerOwnerRoles",
      (select jsonb_build_object('id',transfer.id,'state',case when transfer.expires_at<=clock_timestamp() then 'expired' else transfer.state end,
        'sourceMembership',transfer.source_membership_id,'targetMembership',transfer.target_membership_id,
        'targetMember',target_profile.id,'targetPrincipal',target_profile.principal_id,'targetDisplayName',target_profile.display_name,
        'formerOwnerMode',transfer.former_owner_mode,'formerOwnerRole',transfer.former_owner_role_id,
        'coolingUntil',transfer.cooling_until,'expiresAt',transfer.expires_at,'version',transfer.version)
        from access.ownertransfer transfer join access.membership target on target.id=transfer.target_membership_id
        join member.profile target_profile on target_profile.id=target.member_id
        where transfer.state='pending_acceptance' and transfer.expires_at>clock_timestamp()
          and (transfer.source_membership_id=$1 or transfer.target_membership_id=$1)
        order by transfer.requested_at desc limit 1) pending
      from access.platformowner owner left join access.membership owner_membership on owner_membership.id=owner.membership_id
      left join member.profile owner_profile on owner_profile.id=owner_membership.member_id
      left join access.membership caller_membership on caller_membership.id=$1
      left join member.profile caller_profile on caller_profile.id=caller_membership.member_id where owner.singleton=true`, [membership]);
    const row = result.rows[0];
    if (!row) throw new Error('OWNER_BOOTSTRAP_PENDING');
    return row;
  }

  async createProofSnapshot(database: OperationDatabase, sourceMembership: string,
    input: OwnershipTransferInput, ownershipVersion: number): Promise<OwnershipProofSnapshot> {
    await this.settleExpired(database);
    const result = await database.query<{ source_membership: string; target_access_version: number; former_owner_role_version: number | null }>(`select owner.membership_id source_membership,
      target.access_version target_access_version,case when $4='retain_admin' then
        (select role.version from access.role role where role.id=$5) else null end former_owner_role_version
      from access.platformowner owner
      join access.membership target on target.id=$2 and target.organization_id='tenant-zhudatuan'
        and target.client='operator' and target.status='active' and target.id!~'^membership:temp-'
      join member.profile profile on profile.id=target.member_id and profile.status='active'
        and profile.mobile_ciphertext is not null and profile.mobile_token is not null
      join identity.principal principal on principal.id=profile.principal_id and principal.status='active'
      where owner.singleton=true and owner.state='active' and owner.membership_id=$1 and owner.membership_id<>target.id
        and exists(select 1 from access.membershiprole selfrole where selfrole.membership_id=target.id
          and selfrole.role_id='role:self' and selfrole.effective_at<=clock_timestamp() and selfrole.expires_at is null)
        and exists(select 1 from access.scopegrant selfscope where selfscope.membership_id=target.id
          and selfscope.scope_kind='self' and selfscope.scope_id='self:'||profile.principal_id and selfscope.effect='allow'
          and selfscope.effective_at<=clock_timestamp() and selfscope.expires_at is null)
        and exists(select 1 from access.membershiprole assignment join access.role adminrole on adminrole.id=assignment.role_id
          and adminrole.scope_id='tenant-zhudatuan' and adminrole.status='active'
          join access.rolepermission mapping on mapping.role_id=adminrole.id and mapping.effect='allow'
          join access.permission permission on permission.id=mapping.permission_id and permission.status='active'
          where assignment.membership_id=target.id and assignment.effective_at<=clock_timestamp()
            and (assignment.expires_at is null or assignment.expires_at>clock_timestamp()+interval '7 days')
            and adminrole.id not in('role:self','role-platform-owner-v2','role-platform-owner-successor-v1','role-zhudatuan-pending-operator'))
        and not exists(select 1 from (values('access.center.read'),('identity.password.verify'),
          ('identity.mobile.challenge'),('identity.mobile.manage'),('identity.stepup.start'),
          ('identity.stepup.complete')) required(operation_id)
          where not exists(select 1 from capability.membership_operations(target.id) available
            where available.operation_id=required.operation_id))
        and owner.version=$3 and (($4='remove_admin' and $5::text is null) or ($4='retain_admin' and exists(
          select 1 from access.role role where role.id=$5 and role.scope_id='tenant-zhudatuan' and role.status='active'
            and role.id not in('role:self','role-platform-owner-v2','role-platform-owner-successor-v1','role-zhudatuan-pending-operator')
            and exists(select 1 from access.rolepermission mapping join access.permission permission on permission.id=mapping.permission_id
              where mapping.role_id=role.id and mapping.effect='allow' and permission.status='active'))))
        and not exists(select 1 from access.ownertransfer transfer where transfer.state='pending_acceptance'
          and transfer.expires_at>clock_timestamp()) for update of owner,target`,
    [sourceMembership, input.targetMembership, ownershipVersion, input.formerOwnerMode, input.formerOwnerRole]);
    const row = result.rows[0];
    if (!row) throw new Error('OWNER_TRANSFER_TARGET_INVALID');
    return Object.freeze({ ...input, sourceMembership: row.source_membership, ownershipVersion,
      transferVersion: null, targetAccessVersion: Number(row.target_access_version),
      formerOwnerRoleVersion: row.former_owner_role_version === null ? null : Number(row.former_owner_role_version) });
  }

  async transferProofSnapshot(database: OperationDatabase, transfer: string, actorMembership: string,
    expectedVersion: number, action: 'accept' | 'cancel'): Promise<OwnershipProofSnapshot> {
    await this.settleExpired(database);
    const result = await database.query<{ source_membership_id: string; target_membership_id: string; former_owner_mode: FormerOwnerMode;
      former_owner_role_id: string | null; former_owner_role_version: number | null; ownership_version: number;
      target_access_version: number; cooling_complete: boolean }>(`select transfer.source_membership_id,
      transfer.target_membership_id,transfer.former_owner_mode,transfer.former_owner_role_id,transfer.former_owner_role_version,
      transfer.cooling_until<=clock_timestamp() cooling_complete,owner.version ownership_version,
      target.access_version target_access_version from access.ownertransfer transfer join access.platformowner owner on owner.singleton=true
      join access.membership target on target.id=transfer.target_membership_id and target.status='active' and target.client='operator'
      where transfer.id=$1 and transfer.state='pending_acceptance' and transfer.expires_at>clock_timestamp() and transfer.version=$3
        and (($4='accept' and transfer.target_membership_id=$2) or ($4='cancel' and transfer.source_membership_id=$2))
        and owner.state='active' and owner.membership_id=transfer.source_membership_id for update of transfer,owner,target`,
    [transfer, actorMembership, expectedVersion, action]);
    const row = result.rows[0];
    if (!row) throw new Error(action === 'accept' ? 'OWNER_TRANSFER_TARGET_MISMATCH' : 'OWNER_TRANSFER_FORBIDDEN');
    if (action === 'accept' && !row.cooling_complete) throw new Error('OWNER_TRANSFER_COOLING_PERIOD');
    return Object.freeze({ sourceMembership: row.source_membership_id, targetMembership: row.target_membership_id,
      formerOwnerMode: row.former_owner_mode, formerOwnerRole: row.former_owner_role_id,
      ownershipVersion: Number(row.ownership_version), transferVersion: expectedVersion,
      targetAccessVersion: Number(row.target_access_version),
      formerOwnerRoleVersion: row.former_owner_role_version === null ? null : Number(row.former_owner_role_version) });
  }

  async registerProof(database: OperationDatabase, payload: OwnerActionProofPayload): Promise<void> {
    await database.query(`insert into access.owneractionproof(nonce,action,actor_id,session_id,source_membership_id,target_membership_id,
      former_owner_mode,former_owner_role_id,former_owner_role_version,ownership_version,transfer_version,target_access_version,reason_hash,expires_at,created_at)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,clock_timestamp())`, [payload.nonce, payload.action, payload.actor,
      payload.session, payload.sourceMembership, payload.targetMembership, payload.formerOwnerMode, payload.formerOwnerRole,
      payload.formerOwnerRoleVersion, payload.ownershipVersion, payload.transferVersion, payload.targetAccessVersion,
      payload.reasonHash, payload.expiresAt]);
  }

  async createOwnerTransfer(database: OperationDatabase, id: string, payload: OwnerActionProofPayload): Promise<Readonly<Record<string, unknown>>> {
    const result = await database.query<{ transfer: Readonly<Record<string, unknown>> }>(
      `select access.create_owner_transfer($1,$2,$3,$4,$5,$6) transfer`,
      [id, payload.actor, payload.session, payload.nonce, payload.ownershipVersion, payload.targetAccessVersion]);
    const row = result.rows[0]?.transfer;
    if (!row) throw new Error('OWNER_TRANSFER_ALREADY_PENDING');
    return row;
  }

  async acceptOwnerTransfer(database: OperationDatabase, transfer: string, payload: OwnerActionProofPayload): Promise<Readonly<Record<string, unknown>>> {
    const changed = await database.query<{ transfer: Readonly<Record<string, unknown>> }>(
      `select access.commit_owner_transfer($1,$2,$3,$4,$5,$6,$7) transfer`,
      [transfer, payload.actor, payload.session, payload.nonce, payload.transferVersion,
        payload.ownershipVersion, payload.targetAccessVersion]);
    const row = changed.rows[0]?.transfer;
    if (!row) throw new Error('VERSION_CONFLICT');
    return row;
  }

  async cancelOwnerTransfer(database: OperationDatabase, transfer: string, payload: OwnerActionProofPayload,
    reason: string): Promise<Readonly<Record<string, unknown>>> {
    const result = await database.query<{ transfer: Readonly<Record<string, unknown>> }>(
      `select access.cancel_owner_transfer($1,$2,$3,$4,$5,$6,$7,$8) transfer`,
      [transfer, payload.actor, payload.session, payload.nonce, payload.transferVersion,
        payload.ownershipVersion, payload.targetAccessVersion, reason]);
    const row = result.rows[0]?.transfer;
    if (!row) throw new Error('VERSION_CONFLICT');
    return row;
  }

  private async settleExpired(database: OperationDatabase): Promise<void> {
    await database.query("select pg_advisory_xact_lock(hashtext('zhudatuan:platform-owner-transfer:v1'))");
    await database.query(`select access.expire_owner_transfers()`);
  }
}

export const operatorOwnershipStore = new OperatorOwnershipStore();
