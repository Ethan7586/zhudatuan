<<<<<<< HEAD
import { createHash, randomUUID } from 'node:crypto';
import { checkScope, SCOPE_KINDS, type Scope } from '@shop/authz';
import type { ModuleContext } from '../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../foundation/application/AuditSink';
import { ModuleOperations, requireAccess, rowResult, type OperationDatabase } from '../../foundation/application/ModuleOperations';
import type { OperationRequest } from '../../foundation/application/OperationHandler';
import { IDENTITY_SECURITY_KEYS } from '../../foundation/infrastructure/SecretStore';
import { bodyRecord, textField } from '../../foundation/interface/Validation';
import { DATABASE_POOL } from '../../foundation/persistence/Pool';
import { accessPort, type OwnershipProofSnapshot, type OwnershipTransferInput } from './AccessPort';
import { accessOperatorReadActions } from './AccessReadOperations';
import { OwnerActionProof, type OwnerAction, type OwnerActionProofPayload } from './OwnerActionProof';

export function accessOperations(context: ModuleContext): ModuleOperations {
  const pool = context.container.get(DATABASE_POOL);
  const proofs = new OwnerActionProof(context.container.get(IDENTITY_SECURITY_KEYS).session);
  return new ModuleOperations('access', pool, context.container.get(AUDIT_SINK), {
    ...accessOperatorReadActions(),
=======
import { randomUUID } from 'node:crypto';
import type { ModuleContext } from '../../bootstrap/ModuleRegistry';
import { AUDIT_SINK } from '../../foundation/application/AuditSink';
import { ModuleOperations, requireAccess, rowResult } from '../../foundation/application/ModuleOperations';
import { bodyRecord, keysetResult, queryPage, textField } from '../../foundation/interface/Validation';
import { DATABASE_POOL } from '../../foundation/persistence/Pool';

export function accessOperations(context: ModuleContext): ModuleOperations {
  const pool = context.container.get(DATABASE_POOL);
  return new ModuleOperations('access', pool, context.container.get(AUDIT_SINK), {
    'access.center.read': async (request, database) => {
      const access = requireAccess(request);
      const page = queryPage(request, 500);
      const result = await database.query(`select membership.id,membership.status,membership.access_version,
        coalesce(jsonb_agg(distinct jsonb_build_object('role',role.id,'name',role.name)) filter(where role.id is not null),'[]') roles,
        coalesce(jsonb_agg(distinct jsonb_build_object('id',grant.id,'kind',grant.scope_kind,'scope',grant.scope_id,'effect',grant.effect,'expires',grant.expires_at)) filter(where grant.id is not null),'[]') scopes
        from access.membership membership left join access.membershiprole assignment on assignment.membership_id=membership.id
        left join access.role role on role.id=assignment.role_id left join access.scopegrant grant on grant.membership_id=membership.id
        where membership.organization_id=$1 and ($2::text is null or membership.id>$2)
        group by membership.id order by membership.id limit $3`, [access.scope.id, page.id, page.fetch]);
      return keysetResult(result, page, 'id');
    },
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
    'access.roles.manage': async (request, database) => {
      const access = requireAccess(request);
      const body = bodyRecord(request);
      const role = request.input.path.roleid!;
      const permissions = body.permissions;
      if (!Array.isArray(permissions) || permissions.some((item) => typeof item !== 'string')) throw new Error('VALIDATION_FAILED:permissions');
      const result = await database.query(`with target as (
          insert into access.role(id,scope_id,name,status,version) values($1,$2,$3,'active',0)
          on conflict(id) do update set name=excluded.name,status='active',version=access.role.version+1
          where access.role.scope_id=$2 and ($5::bigint is null or access.role.version=$5) returning *
<<<<<<< HEAD
        ), removed as (delete from access.rolepermission mapping using target
          where mapping.role_id=target.id returning mapping.role_id), ready as (
          select distinct target.id from target left join removed on removed.role_id=target.id
        ), added as (
          insert into access.rolepermission(role_id,permission_id,effect)
          select ready.id,permission.id,'allow' from ready cross join access.permission permission
          where permission.code=any($4::text[]) returning role_id
=======
        ), removed as (delete from access.rolepermission where role_id=$1), added as (
          insert into access.rolepermission(role_id,permission_id,effect)
          select $1,permission.id,'allow' from access.permission permission where permission.code=any($4::text[]) returning role_id
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
        ) select * from target`, [role, access.scope.id, textField(body, 'name'), permissions, request.input.expectedVersion ?? null]);
      if (!result.rows[0]) throw new Error('VERSION_CONFLICT');
      return rowResult(result);
    },
    'access.scopes.manage': async (request, database) => {
      const access = requireAccess(request);
      const body = bodyRecord(request);
      const membership = request.input.path.membershipid!;
      const kind = textField(body, 'kind');
      const scope = textField(body, 'scope');
<<<<<<< HEAD
      if (body.effect === 'deny') throw new Error('SCOPE_DENY_UNSUPPORTED');
      if (body.effect !== undefined && body.effect !== 'allow') throw new Error('VALIDATION_FAILED:effect');
      const effect = 'allow';
      const resolved = await database.query<{ scope: unknown; target_membership_scope: unknown }>(`select access.scope_object($1) scope,
        access.scope_object(target.organization_id) target_membership_scope
        from access.membership target where target.id=$2 and target.status='active'
        for update of target`, [scope, membership]);
      const targetScope = canonicalScope(resolved.rows[0]?.scope);
      const targetMembershipScope = canonicalScope(resolved.rows[0]?.target_membership_scope);
      const scopeDecision = targetScope === null ? null
        : checkScope(access.membership, 'access.scope.manage', targetScope, new Date());
      if (targetScope === null || targetMembershipScope === null || kind !== targetScope.kind
        || access.scope.kind !== targetScope.kind || access.scope.id !== targetScope.id
        || scopeDecision === null || 'reason' in scopeDecision
        || !scopesAreRelated(targetScope, targetMembershipScope)) throw new Error('CANNOT_GRANT_UNOWNED_SCOPE');
=======
      const effect = body.effect === 'deny' ? 'deny' : 'allow';
      const contained = await database.query(`select 1 from access.scopegrant grant where grant.membership_id=$1 and grant.effect='allow'
        and grant.scope_id=$2 and grant.scope_kind=$3 and grant.effective_at<=clock_timestamp()
        and (grant.expires_at is null or grant.expires_at>clock_timestamp())`, [access.membership.id, scope, kind]);
      if (!contained.rows[0]) throw new Error('CANNOT_GRANT_UNOWNED_SCOPE');
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
      const result = await database.query(`with changed as (
          insert into access.scopegrant(id,membership_id,scope_kind,scope_id,scope_path,effect,effective_at,expires_at,access_version)
          values($1,$2,$3,$4,$5,$6,clock_timestamp(),$7,(select access_version+1 from access.membership where id=$2))
          on conflict(membership_id,scope_kind,scope_id,effect,effective_at) do nothing returning *
        ), raised as (update access.membership set access_version=access_version+1 where id=$2 returning access_version)
<<<<<<< HEAD
        select changed.*,raised.access_version from changed cross join raised`, [`scope:${randomUUID()}`, membership, targetScope.kind,
        targetScope.id, canonicalScopePath(targetScope), effect, body.expiresAt ?? null]);
      return rowResult(result, 200);
    },
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

function canonicalScope(value: unknown): Scope | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as Readonly<Record<string, unknown>>;
  if (typeof candidate.kind !== 'string' || !(SCOPE_KINDS as readonly string[]).includes(candidate.kind)
    || typeof candidate.id !== 'string' || candidate.id.length === 0
    || (candidate.tenant !== undefined && typeof candidate.tenant !== 'string')
    || !Array.isArray(candidate.path)) return null;
  const path = candidate.path.map((item) => {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) return null;
    const ancestor = item as Readonly<Record<string, unknown>>;
    if (typeof ancestor.kind !== 'string' || !(SCOPE_KINDS as readonly string[]).includes(ancestor.kind)
      || typeof ancestor.id !== 'string' || ancestor.id.length === 0) return null;
    return { kind: ancestor.kind as Scope['kind'], id: ancestor.id };
  });
  if (path.some((ancestor) => ancestor === null)) return null;
  return {
    kind: candidate.kind as Scope['kind'], id: candidate.id,
    ...(candidate.tenant === undefined ? {} : { tenant: candidate.tenant as string }),
    path: path as Scope['path'],
  };
}

function scopesAreRelated(left: Scope, right: Scope): boolean {
  return scopeContains(left, right) || scopeContains(right, left);
}

function scopeContains(ancestor: Scope, descendant: Scope): boolean {
  return (ancestor.kind === descendant.kind && ancestor.id === descendant.id)
    || descendant.path.some((candidate) => candidate.kind === ancestor.kind && candidate.id === ancestor.id);
}

function canonicalScopePath(scope: Scope): string {
  return [...scope.path.map((ancestor) => ancestor.id), scope.id].join('/');
}

function transferInput(request: OperationRequest): OwnershipTransferInput {
  const body = bodyRecord(request);
  const mode = textField(body, 'formerOwnerMode');
  if (mode !== 'retain_admin' && mode !== 'remove_admin') throw new Error('VALIDATION_FAILED:formerOwnerMode');
  const role = typeof body.formerOwnerRole === 'string' && body.formerOwnerRole.trim() ? body.formerOwnerRole.trim() : null;
  if ((mode === 'retain_admin') !== (role !== null)) throw new Error('OWNER_TRANSFER_ROLE_INVALID');
  return Object.freeze({ targetMembership: textField(body, 'targetMembership'), formerOwnerMode: mode, formerOwnerRole: role });
}

function requireExpectedVersion(request: OperationRequest): number {
  if (request.input.expectedVersion === undefined) throw new Error('EXPECTED_VERSION_REQUIRED');
  return request.input.expectedVersion;
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
=======
        select changed.*,raised.access_version from changed cross join raised`, [`scope:${randomUUID()}`, membership, kind, scope, `${access.scope.id}/${scope}`, effect, body.expiresAt ?? null]);
      return rowResult(result, 200);
    },
  });
}
>>>>>>> a7d9b2c8 (chore: establish zhudatuan main platform baseline)
