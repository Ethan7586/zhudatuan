import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import type { OperationId } from '@shop/contract';
import { reject, requireAccess, rowResult, type OperationActions } from '../../../../foundation/application/ModuleOperations';
import { bodyRecord, integerField, secretField, textField } from '../../../../foundation/interface/Validation';
import type { OperationRequest } from '../../../../foundation/application/OperationHandler';
import { requireGovernanceContext } from '../../../../foundation/security/AccessContext';
import { accessPort } from '../../../access';
import { memberPort } from '../../../member';
import { organizationPort } from '../../../organization';
import { canonicalMobile } from '../../02_domain_yewu/models_moxing/IdentitySubject';
import { currentRealmAccount } from '../../03_application_yingyong/services_fuwu/RealmAccount';
import {
  maskInvitationMobile,
  requireValidStorefront,
  storefrontSlug,
  type RealmOperationContext,
} from './RealmOperationContext';

export const MEMBERSHIP_INVITATION_OPERATION_IDS = Object.freeze([
  'identity.invitations.read',
  'identity.storefronts.read',
  'identity.invitations.create',
  'identity.invitations.revoke',
  'identity.members.manage',
] as const satisfies readonly OperationId[]);

export function membershipInvitationOperations(runtime: RealmOperationContext): OperationActions {
  const { digest, passwords, registrationOnly } = runtime;
  return {
      'identity.invitations.read': async (request, database) => {
        const body = bodyRecord(request);
        const result = await memberPort.invite(database, digest(textField(body, 'invite')));
        return rowResult(result);
      },
      'identity.storefronts.read': async (request, database) => {
        const body = bodyRecord(request);
        const storefront = await requireValidStorefront(memberPort.storefrontRegistration(database, storefrontSlug(body)));
        return {
          status: 200,
          body: {
            terms_title: storefront.terms_title,
            terms_body: storefront.terms_body,
            privacy_title: storefront.privacy_title,
            privacy_body: storefront.privacy_body,
            terms_hash: storefront.terms_hash,
            application_id: storefront.application_id,
            application_slug: storefront.application_slug,
            organization_id: storefront.organization_id,
            organization_name: storefront.organization_name,
            target_client: 'storefront',
          },
        };
      },
      'identity.invitations.create': async (request, database) => {
        const access = requireAccess(request);
        const body = bodyRecord(request);
        const label = textField(body, 'label', 80);
        const requestedTarget = body.targetClient;
        if (requestedTarget !== undefined && requestedTarget !== 'storefront' && requestedTarget !== 'operator') throw new Error('INVALID_INVITATION_INPUT');
        const targetClient = registrationOnly ? 'operator' : requestedTarget ?? 'storefront';
        const governanceLevel = invitationGovernanceLevel(body.governanceLevel, targetClient);
        const invitationScope = access.scope.kind === 'platform' && targetClient === 'operator'
          ? textField(body, 'tenantId') : access.scope.id;
        if (access.scope.kind === 'platform' && targetClient === 'operator') {
          const target = await database.query<{ id: string }>(`select organization.id from organization.organization organization
          where organization.id=$1 and organization.kind='tenant' and organization.status='active'
            and access.scope_allowed(organization.id)`, [invitationScope]);
          if (target.rows[0]?.id !== invitationScope) reject(403, 'PERMISSION_DENIED');
          await database.query(`select set_config('app.scope_id',$1,true)`, [invitationScope]);
        }
        requireInvitationManager(request);
        if (governanceLevel === 'senior_administrator' && !requireGovernanceContext(access).isExactOwner) {
          reject(403, 'PERMISSION_DENIED');
        }
        if (registrationOnly && requestedTarget !== undefined && requestedTarget !== 'operator') throw new Error('INVALID_INVITATION_INPUT');
        const maxUses = integerField(body, 'maxUses', 1);
        const expiresAt = inviteExpiry(body.expiresAt);
        if (label.length < 2 || maxUses > 500 || (targetClient === 'operator' && maxUses !== 1)) throw new Error('INVALID_INVITATION_INPUT');
        if (targetClient === 'operator' && access.scope.kind !== 'platform'
          && (access.scope.kind !== 'tenant' || access.scope.id !== access.scope.tenant)) throw new Error('INVITATION_SCOPE_INVALID');
        if (targetClient === 'storefront' && access.scope.kind !== 'mall') throw new Error('INVITATION_SCOPE_INVALID');
        const destination = targetClient === 'operator' ? canonicalMobile(textField(body, 'destination', 32)) : null;
        const destinationHash = destination === null ? null : digest(destination);
        const requestedStorefront = typeof body.storefrontOrganization === 'string' && body.storefrontOrganization.trim().length > 0
          ? body.storefrontOrganization.trim() : null;
        const storefronts = targetClient === 'operator'
          ? await database.query<{ id: string }>(`select storefront.id from organization.organization storefront
            join organization.unitclosure closure on closure.descendant_id=storefront.id
            where closure.ancestor_id=$1 and storefront.kind='mall' and storefront.status='active'
              and ($2::text is null or storefront.id=$2) order by storefront.id limit 2`, [invitationScope, requestedStorefront])
          : { rows: [] };
        if (targetClient === 'operator' && storefronts.rows.length !== 1) throw new Error('STOREFRONT_SCOPE_REQUIRED');
        const operatorRoleId = targetClient === 'operator'
          ? governanceLevel === 'senior_administrator'
            ? seniorAdministratorRoleId(invitationScope)
            : 'role-zhudatuan-pending-operator'
          : null;
        const role = await database.query<{ id: string }>(`select role.id from access.role role where role.scope_id=$2
        and role.status='active'
        and (($4::text='storefront' and role.name='商城会员') or ($4::text='operator' and role.id=$1))
        and ($3::text is distinct from 'administrator' or not exists(
          select 1 from access.rolepermission pendingpermission where pendingpermission.role_id=role.id))
        order by role.id limit 2`,
        [operatorRoleId, invitationScope, governanceLevel, targetClient]);
        if (role.rows.length !== 1) throw new Error('EMPLOYEE_ROLE_NOT_FOUND');
        const roleId = role.rows[0]!.id;
        const policy = await database.query<{ id: string; terms_hash: string }>(`select id,terms_hash from identity.registrationpolicy
        where effective_at<=clock_timestamp() and (retired_at is null or retired_at>clock_timestamp()) order by version desc limit 1`);
        if (!policy.rows[0]) throw new Error('INVITE_INVALID');
        const id = `invite:${randomUUID()}`;
        const code = `${'ABCDEF'.charAt(randomInt(6))}${'ABCDEF'.charAt(randomInt(6))}${randomBytes(4).toString('hex').toUpperCase()}`;
        const result = await database.query(
          `insert into member.invite(id,organization_id,label,destination_hash,token_hash,expires_at,created_by,
        role_id,allowed_destination_hash,max_uses,use_count,effective_at,status,created_at,registration_policy_id,terms_hash,version,
        target_client,storefront_organization_id,destination_masked)
        values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,0,clock_timestamp(),'active',clock_timestamp(),$11,$12,0,$13,$14,$15)
        returning id,label,case target_client when 'operator' then 'console' else target_client end target,
          max_uses,use_count,effective_at starts_at,expires_at,status,created_at,version`,
          [id, invitationScope, label, destinationHash ?? digest(id), digest(code), expiresAt, access.membership.id,
            roleId, destinationHash, maxUses, policy.rows[0].id, policy.rows[0].terms_hash,
            targetClient, storefronts.rows[0]?.id ?? null, destination === null ? null : maskInvitationMobile(destination)]
        );
        const saved = result.rows[0];
        if (!saved) throw new Error('INVITE_INVALID');
        return { status: 201, body: { ...saved, code, ...(governanceLevel === null ? {} : { governanceLevel }) }, headers: { etag: '"0"' } };
      },
      'identity.invitations.revoke': async (request, database) => {
        const { invitationAuthority } = requireInvitationManager(request);
        const body = bodyRecord(request);
        const reason = textField(body, 'reason', 1000);
        if (reason.length < 4) throw new Error('CHANGE_REASON_REQUIRED');
        const id = request.input.path.invitationid!;
        const result = await database.query(
          `update member.invite set status='disabled',version=version+1
        where id=$1 and access.scope_allowed(organization_id)
          and (not $3::boolean or (target_client='operator' and organization_id='tenant-zhudatuan'))
          and (target_client<>'operator' or $4::boolean)
          and status='active' and ($2::bigint is null or version=$2)
        returning id,label,target_client,max_uses,use_count,effective_at starts_at,expires_at,status,created_at,version`,
          [id, request.input.expectedVersion ?? null, registrationOnly, invitationAuthority]
        );
        if (result.rows[0]) return rowResult(result);
        const current = await database.query<{ status: string; version: number }>(
          `select status,version from member.invite
        where id=$1 and access.scope_allowed(organization_id)
          and (not $2::boolean or (target_client='operator' and organization_id='tenant-zhudatuan'))
          and (target_client<>'operator' or $3::boolean)`,
          [id, registrationOnly, invitationAuthority]
        );
        if (!current.rows[0]) throw new Error('INVITATION_NOT_FOUND');
        if (request.input.expectedVersion !== undefined && current.rows[0].version !== request.input.expectedVersion) throw new Error('VERSION_CONFLICT');
        if (current.rows[0].status === 'active') throw new Error('VERSION_CONFLICT');
        return { status: 200, body: { id, status: current.rows[0].status, version: current.rows[0].version }, headers: { etag: `"${String(current.rows[0].version)}"` } };
      },
      'identity.members.manage': async (request, database) => {
        const access = requireAccess(request);
        const body = bodyRecord(request);
        const action = body.action === 'update' || body.action === 'status' ? body.action : 'create';
        const membershipId = request.input.path.membershipid!;
        const reason = textField(body, 'reason', 1000);
        if (reason.trim().length < 4) throw new Error('CHANGE_REASON_REQUIRED');
        if (action === 'create') {
          const actorAccount = await currentRealmAccount(database, access.membership.id, access.actor.id);
          const username = textField(body, 'username', 128).trim();
          const password = await passwords.hash(secretField(body, 'password', 128));
          const principal = `principal:${randomUUID()}`;
          const account = `account:${randomUUID()}`;
          const member = `member:${randomUUID()}`;
          const membership = membershipId === 'new' ? `membership:${randomUUID()}` : membershipId;
          const credential = `credential:${randomUUID()}`;
          const role = await database.query<{ id: string }>(
            `select id from access.role where scope_id=$1 and status='active'
          and id='role-employee' limit 1`,
            [access.scope.id]
          );
          if (!role.rows[0]) throw new Error('EMPLOYEE_ROLE_NOT_FOUND');
          const exists = await database.query('select 1 from identity.credential where realm_id=$1 and provider=$2 and subject_hash=$3',
            [actorAccount.realmId, 'password', digest(username)]);
          if (exists.rows[0]) throw new Error('IDENTITY_SUBJECT_EXISTS');
          await database.query(`insert into identity.principal(id,status,created_at,updated_at) values($1,'active',clock_timestamp(),clock_timestamp())`, [principal]);
          await database.query(`insert into identity.account(id,realm_id,legacy_principal_id,status,created_at,updated_at)
            values($1,$2,$3,'active',clock_timestamp(),clock_timestamp())`, [account, actorAccount.realmId, principal]);
          await database.query(
            `insert into identity.credential(id,principal_id,provider,subject_hash,secret_hash,status,created_at,realm_id,account_id)
          values($1,$2,'password',$3,$4,'active',clock_timestamp(),$5,$6)`,
            [credential, principal, digest(username), password, actorAccount.realmId, account]
          );
          await memberPort.create(database, { member, principal, display: textField(body, 'displayName', 128), status: 'active' });
          const scopeKind = await organizationPort.kind(database, access.scope.id);
          const result = await accessPort.createRegistration(database, {
            membership,
            member,
            principal,
            organization: access.scope.id,
            realm: actorAccount.realmId,
            account,
            employee: typeof body.employeeNo === 'string' ? body.employeeNo.trim() || null : null,
            role: role.rows[0].id,
            scopeKind,
            scopes: [`scope:${randomUUID()}`, `scope:${randomUUID()}`, `scope:${randomUUID()}`],
          });
          if (result.realm_id !== actorAccount.realmId || result.account_id !== account) {
            throw new Error('MEMBERSHIP_REALM_BINDING_FAILED');
          }
          return { status: 201, body: { ...result, membershipId: membership, memberId: member, userId: principal } };
        }
        const target = await database.query<{
          member_id: string;
          governance_level: 'owner' | 'senior_administrator' | 'administrator' | 'member';
        }>(
          `select membership.member_id,target_governance.governance_level
          from access.membership membership
          join member.profile profile on profile.id=membership.member_id
          cross join lateral access.resolve_governance(
            membership.id,profile.principal_id,$2,$3) target_governance
          where membership.id=$1 and access.scope_allowed(membership.organization_id)
          for update of membership`,
          [membershipId, access.scope.kind, access.scope.id]
        );
        if (!target.rows[0]) throw new Error('MEMBERSHIP_NOT_FOUND');
        if (!requireGovernanceContext(access).isExactOwner
          && (target.rows[0].governance_level === 'owner' || target.rows[0].governance_level === 'senior_administrator')) {
          reject(403, 'PERMISSION_DENIED');
        }
        if (action === 'status') {
          const status = body.status === 'offboarded' ? 'left' : body.status;
          if (!['active', 'suspended', 'left'].includes(String(status))) throw new Error('MEMBERSHIP_STATUS_INVALID');
          const result = await database.query(
            `update access.membership set status=$2,access_version=access_version+1,
          left_at=case when $2='left' then clock_timestamp() else null end where id=$1 returning *`,
            [membershipId, status]
          );
          await accessPort.revokeSessions(database, membershipId);
          return rowResult(result);
        }
        const displayName = textField(body, 'displayName', 128);
        const result = await database.query(
          `update member.profile set display_name=$2,version=version+1,updated_at=clock_timestamp()
        where id=$1 returning *`,
          [target.rows[0].member_id, displayName]
        );
        if (typeof body.departmentId === 'string' && body.departmentId.length > 0) {
          await database.query(`delete from access.scopegrant where membership_id=$1 and scope_kind='department'`, [membershipId]);
          await database.query(
            `insert into access.scopegrant(id,membership_id,scope_kind,scope_id,scope_path,effect,effective_at,access_version)
          values($1,$2,'department',$3,$4,'allow',clock_timestamp(),(select access_version+1 from access.membership where id=$2))`,
            [`scope:${randomUUID()}`, membershipId, body.departmentId, `${access.scope.id}/${body.departmentId}`]
          );
        }
        await accessPort.revokeSessions(database, membershipId);
        return rowResult(result);
      },
  };
}

function requireInvitationManager(request: OperationRequest) {
  const access = requireAccess(request);
  const permission = access.membership.grants.some((grant) => grant.permissions.includes('identity.invitation.manage'));
  if (access.actor.target !== 'console' || !access.capabilities.includes(request.type) || !permission) reject(403, 'PERMISSION_DENIED');
  const governance = requireGovernanceContext(access);
  const invitationAuthority = governance.isExactOwner || governance.governanceLevel === 'senior_administrator';
  if (!invitationAuthority) reject(403, 'PERMISSION_DENIED');
  return { access, invitationAuthority };
}

function invitationGovernanceLevel(value: unknown, targetClient: 'storefront' | 'operator'):
  'administrator' | 'senior_administrator' | null {
  if (targetClient !== 'operator') {
    if (value !== undefined) throw new Error('INVALID_INVITATION_INPUT');
    return null;
  }
  if (value === undefined || value === 'administrator') return 'administrator';
  if (value === 'senior_administrator') return value;
  throw new Error('INVALID_INVITATION_INPUT');
}

function seniorAdministratorRoleId(organization: string): string {
  return `role-senior-administrator-v1:${organization}`;
}

function inviteExpiry(value: unknown): string {
  if (typeof value !== 'string') throw new Error('INVALID_INVITATION_INPUT');
  const time = new Date(value).getTime();
  const now = Date.now();
  if (!Number.isFinite(time) || time <= now + 10 * 60_000 || time > now + 90 * 24 * 60 * 60_000) throw new Error('INVALID_INVITATION_INPUT');
  return new Date(time).toISOString();
}
