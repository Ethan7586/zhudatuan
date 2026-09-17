import { createHash, randomUUID } from 'node:crypto';
import type { ModuleContext } from '../../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../../foundation/application/AuditSink';
import { ModuleOperations, requireAccess, rowResult, type OperationDatabase } from '../../../foundation/application/ModuleOperations';
import type { OperationRequest } from '../../../foundation/application/OperationHandler';
import { IDENTITY_SECURITY_KEYS } from '../../../foundation/infrastructure/SecretStore';
import { bodyRecord, textField } from '../../../foundation/interface/Validation';
import { DATABASE_POOL } from '../../../foundation/persistence/Pool';
import { accessPort, type OwnershipProofSnapshot, type OwnershipTransferInput } from '../01_public_gongkai/AccessPort';
import { accessOperatorReadActions } from './AccessReadOperations';
import type { OwnerAction, OwnerActionProofPayload } from '../02_domain_yewu/AccessOwnership';
import { OwnerActionProof } from './OwnerActionProof';
import { administratorSegmentWriteActions } from './AdministratorSegmentOperations';
import { numericVersion, requireExpectedVersion } from './AccessOperationValues';
import { demoteAdministrator, offboardAdministrator } from './OperatorLifecycleOperations';
import { grantOperatorScope, manageRoleAssignment, requireManagementTarget,
  type ManagementTargetRow } from './OperatorGrantOperations';

export function accessOperations(context: ModuleContext): ModuleOperations {
  const pool = context.container.get(DATABASE_POOL);
  const proofs = new OwnerActionProof(context.container.get(IDENTITY_SECURITY_KEYS).session);
  return new ModuleOperations('access', pool, context.container.get(AUDIT_SINK), {
    ...accessOperatorReadActions(),
    ...administratorSegmentWriteActions(),
    'access.roles.manage': async (request, database) => {
      const access = requireAccess(request);
      const body = bodyRecord(request);
      const role = request.input.path.roleid!;
      if (body.action === 'offboard') return offboardAdministrator(request, database, access);
      if (body.action === 'demote') return demoteAdministrator(request, database, access, role);
      if (body.action === 'assign' || body.action === 'revoke') {
        return manageRoleAssignment(request, database, access, role, body.action);
      }
      if (body.action === 'delete') return deleteCustomRole(request, database, access, role);
      if (body.action !== undefined) throw new Error('VALIDATION_FAILED:action');
      const permissions = body.permissions;
      if (!Array.isArray(permissions) || permissions.some((item) => typeof item !== 'string')) throw new Error('VALIDATION_FAILED:permissions');
      const assignedTargets = await database.query<ManagementTargetRow>(`select target.id target_membership_id,
        target.client target_client,target.status target_status,target.realm_id target_realm_id,
        actor.realm_id actor_realm_id,access.scope_object(target.organization_id) target_membership_scope,
        exists(select 1 from identity.realmtarget realm_target where realm_target.realm_id=target.realm_id
          and realm_target.surface='admin' and realm_target.membership_client='operator') target_realm_binding,
        exists(select 1 from identity.realmtarget realm_target where realm_target.realm_id=target.realm_id
          and realm_target.surface='admin' and realm_target.membership_client='operator'
          and realm_target.membership_organization_id=target.organization_id) target_organization_binding
        from access.membershiprole assignment
        join access.membership target on target.id=assignment.membership_id
        join access.membership actor on actor.id=$3 and actor.status='active' and actor.client='operator'
        where assignment.role_id=$1 and assignment.effective_at<=clock_timestamp()
          and (assignment.expires_at is null or assignment.expires_at>clock_timestamp())
          and exists(select 1 from access.permission permission
            join capability.operation operation on operation.permission_code=permission.code and operation.audience='operator'
            where permission.code=any($2::text[]) and permission.status='active'
              and not exists(select 1 from capability.operation other where other.permission_code=permission.code
                and other.audience<>'operator'))
        order by target.id for update of target`, [role, permissions, access.membership.id]);
      for (const target of assignedTargets.rows) requireManagementTarget(target, access.scope);
      const result = await database.query(`with target as (
          insert into access.role(id,scope_id,name,status,version) values($1,$2,$3,'active',0)
          on conflict(id) do update set name=excluded.name,status='active',version=access.role.version+1
          where access.role.scope_id=$2 and ($5::bigint is null or access.role.version=$5) returning *
        ), removed as (delete from access.rolepermission mapping using target
          where mapping.role_id=target.id and mapping.effect='allow' returning mapping.role_id), ready as (
          select distinct target.id from target left join removed on removed.role_id=target.id
        ), added as (
          insert into access.rolepermission(role_id,permission_id,effect)
          select ready.id,permission.id,'allow' from ready cross join access.permission permission
          where permission.code=any($4::text[]) returning role_id
        ) select * from target`, [role, access.scope.id, textField(body, 'name'), permissions, request.input.expectedVersion ?? null]);
      if (!result.rows[0]) throw new Error('VERSION_CONFLICT');
      const affected = (await database.query<{ id: string; access_version: string | number }>(`update access.membership membership
        set access_version=membership.access_version+1 from (
          select distinct assignment.membership_id from access.membershiprole assignment
          where assignment.role_id=$1 and assignment.effective_at<=clock_timestamp()
            and (assignment.expires_at is null or assignment.expires_at>clock_timestamp())
        ) assignment where membership.id=assignment.membership_id returning membership.id,membership.access_version`, [role]))
        .rows.map((row) => ({ membership: row.id, access_version: numericVersion(row.access_version) }));
      const saved = rowResult(result);
      return { ...saved, body: Object.freeze({ ...(saved.body as Readonly<Record<string, unknown>>), affected_memberships: affected }) };
    },
    'access.scopes.manage': grantOperatorScope,
    'access.ownership.read': async (request, database) => {
      const access = requireAccess(request);
      return { status: 200, body: await accessPort.ownership(database, access.membership.id) };
    },
    'access.ownership.transfers.preview': async (request, database) => {
      const access = requireAccess(request);
      const expectedVersion = requireExpectedVersion(request);
      const snapshot = await accessPort.createProofSnapshot(database, access.membership.id, transferInput(request), expectedVersion);
      const issued = proofs.issue(proofInput('create', request, snapshot, null));
      await accessPort.registerProof(database, issued.payload);
      return { status: 200, body: proofResponse(issued.proof, issued.payload) };
    },
    'access.ownership.transfers.create': async (request, database) => {
      const access = requireAccess(request);
      const expectedVersion = requireExpectedVersion(request);
      const snapshot = await accessPort.createProofSnapshot(database, access.membership.id, transferInput(request), expectedVersion);
      const payload = proofs.verify(request.input.headers['x-action-proof'], proofInput('create', request, snapshot, null));
      const transfer = await accessPort.createOwnerTransfer(database, `owner-transfer:${randomUUID()}`, payload);
      await publishOwnerEvent(database, 'access.owner.transfer.initiated', String(transfer.id), access.trace, transfer);
      return { status: 201, body: transfer, headers: { etag: `"${String(transfer.version)}"` } };
    },
    'access.ownership.transfers.accept.preview': async (request, database) => {
      const access = requireAccess(request);
      const expectedVersion = requireExpectedVersion(request);
      const transfer = request.input.path.transferid!;
      const snapshot = await accessPort.transferProofSnapshot(database, transfer, access.membership.id, expectedVersion, 'accept');
      const issued = proofs.issue(proofInput('accept', request, snapshot, null));
      await accessPort.registerProof(database, issued.payload);
      return { status: 200, body: proofResponse(issued.proof, issued.payload) };
    },
    'access.ownership.transfers.accept': async (request, database) => {
      const access = requireAccess(request);
      const expectedVersion = requireExpectedVersion(request);
      const transfer = request.input.path.transferid!;
      const snapshot = await accessPort.transferProofSnapshot(database, transfer, access.membership.id, expectedVersion, 'accept');
      const payload = proofs.verify(request.input.headers['x-action-proof'], proofInput('accept', request, snapshot, null));
      const accepted = await accessPort.acceptOwnerTransfer(database, transfer, payload);
      await publishOwnerEvent(database, 'access.owner.transferred', transfer, access.trace, {
        transfer, previousOwnerMembership: payload.sourceMembership, ownerMembership: payload.targetMembership,
        ownershipVersion: accepted.ownershipVersion,
      });
      const ownership = await accessPort.ownership(database, payload.targetMembership);
      return { status: 200, body: { ...ownership, transfer: accepted }, headers: { etag: `"${String(accepted.version)}"` } };
    },
    'access.ownership.transfers.cancel.preview': async (request, database) => {
      const access = requireAccess(request);
      const expectedVersion = requireExpectedVersion(request);
      const transfer = request.input.path.transferid!;
      const reason = transferReason(request);
      const snapshot = await accessPort.transferProofSnapshot(database, transfer, access.membership.id, expectedVersion, 'cancel');
      const issued = proofs.issue(proofInput('cancel', request, snapshot, reasonHash(reason)));
      await accessPort.registerProof(database, issued.payload);
      return { status: 200, body: proofResponse(issued.proof, issued.payload) };
    },
    'access.ownership.transfers.cancel': async (request, database) => {
      const access = requireAccess(request);
      const expectedVersion = requireExpectedVersion(request);
      const transfer = request.input.path.transferid!;
      const reason = transferReason(request);
      const snapshot = await accessPort.transferProofSnapshot(database, transfer, access.membership.id, expectedVersion, 'cancel');
      const payload = proofs.verify(request.input.headers['x-action-proof'], proofInput('cancel', request, snapshot, reasonHash(reason)));
      const cancelled = await accessPort.cancelOwnerTransfer(database, transfer, payload, reason);
      await publishOwnerEvent(database, 'access.owner.transfer.cancelled', transfer, access.trace, cancelled);
      return { status: 200, body: cancelled, headers: { etag: `"${String(cancelled.version)}"` } };
    },
  });
}

async function deleteCustomRole(request: OperationRequest, database: OperationDatabase, access: ReturnType<typeof requireAccess>,
  role: string): Promise<Readonly<{ status: number; body: Readonly<Record<string, unknown>> }>> {
  const expectedVersion = requireExpectedVersion(request);
  const selected = await database.query<{ id: string; name: string; version: string | number }>(`select id,name,version from access.role
    where id=$1 and scope_id=$2 and id not in(
      'role:self','role-platform-owner-v2','role-platform-owner-successor-v1','role-zhudatuan-pending-operator') for update`,
  [role, access.scope.id]);
  const target = selected.rows[0];
  if (target === undefined) throw new Error('ROLE_DELETE_NOT_AVAILABLE');
  if (numericVersion(target.version) !== expectedVersion) throw new Error('VERSION_CONFLICT');
  const detached = await database.query<{ membership_id: string }>('delete from access.membershiprole where role_id=$1 returning membership_id', [role]);
  await database.query('delete from access.rolepermission where role_id=$1', [role]);
  const deleted = await database.query<{ id: string; name: string }>('delete from access.role where id=$1 and scope_id=$2 returning id,name',
    [role, access.scope.id]);
  if (deleted.rows[0] === undefined) throw new Error('ROLE_DELETE_FAILED');
  const affectedMemberships = [...new Set(detached.rows.map(({ membership_id }) => membership_id))];
  const affected = affectedMemberships.length === 0 ? [] : (await database.query<{ id: string; access_version: string | number }>(
    'update access.membership set access_version=access_version+1 where id=any($1::text[]) returning id,access_version',
    [affectedMemberships])).rows.map((row) => ({ membership: row.id, access_version: numericVersion(row.access_version) }));
  return { status: 200, body: Object.freeze({ action: 'delete', deleted: true, role: target.id, name: target.name,
    affected_memberships: affected }) };
}

function transferInput(request: OperationRequest): OwnershipTransferInput {
  const body = bodyRecord(request);
  const mode = textField(body, 'formerOwnerMode');
  if (mode !== 'retain_admin' && mode !== 'remove_admin') throw new Error('VALIDATION_FAILED:formerOwnerMode');
  const role = typeof body.formerOwnerRole === 'string' && body.formerOwnerRole.trim() ? body.formerOwnerRole.trim() : null;
  if ((mode === 'retain_admin') !== (role !== null)) throw new Error('OWNER_TRANSFER_ROLE_INVALID');
  return Object.freeze({ targetMembership: textField(body, 'targetMembership'), formerOwnerMode: mode, formerOwnerRole: role });
}

function proofInput(action: OwnerAction, request: OperationRequest, snapshot: OwnershipProofSnapshot,
  reasonHashValue: string | null): Omit<OwnerActionProofPayload, 'v' | 'nonce' | 'expiresAt'> {
  const access = requireAccess(request);
  return Object.freeze({ action, actor: access.actor.id, session: access.actor.session,
    sourceMembership: snapshot.sourceMembership, targetMembership: snapshot.targetMembership,
    formerOwnerMode: snapshot.formerOwnerMode, formerOwnerRole: snapshot.formerOwnerRole,
    formerOwnerRoleVersion: snapshot.formerOwnerRoleVersion,
    ownershipVersion: snapshot.ownershipVersion, transferVersion: snapshot.transferVersion,
    targetAccessVersion: snapshot.targetAccessVersion, reasonHash: reasonHashValue });
}

function proofResponse(proof: string, payload: OwnerActionProofPayload): Readonly<Record<string, unknown>> {
  return Object.freeze({ proof, proofExpiresAt: payload.expiresAt, ownershipVersion: payload.ownershipVersion,
    transferVersion: payload.transferVersion, targetAccessVersion: payload.targetAccessVersion,
    sourceMembership: payload.sourceMembership, targetMembership: payload.targetMembership,
    formerOwnerMode: payload.formerOwnerMode, formerOwnerRole: payload.formerOwnerRole,
    formerOwnerRoleVersion: payload.formerOwnerRoleVersion });
}

function transferReason(request: OperationRequest): string {
  const reason = textField(bodyRecord(request), 'reason').trim();
  if (reason.length < 3 || reason.length > 500) throw new Error('VALIDATION_FAILED:reason');
  return reason;
}

function reasonHash(value: string): string { return createHash('sha256').update(value).digest('hex'); }

async function publishOwnerEvent(database: OperationDatabase, type: string, aggregate: string,
  trace: string, payload: unknown): Promise<void> {
  await database.query(`insert into runtime.outbox(id,event_type,event_version,aggregate_type,aggregate_id,scope_id,payload,trace_id,occurred_at,available_at)
    values($1,$2,1,'access',$3,'tenant-zhudatuan',$4::jsonb,$5,clock_timestamp(),clock_timestamp())`,
  [`event:${randomUUID()}`, type, aggregate, JSON.stringify(payload), trace]);
}
