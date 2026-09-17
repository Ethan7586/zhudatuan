import { createHash, randomUUID } from 'node:crypto';
import type { ModuleContext } from '../../../bootstrap/ModuleRegistry';
import { requireAccess, type OperationActions, type OperationDatabase } from '../../../foundation/application/ModuleOperations';
import type { OperationRequest } from '../../../foundation/application/OperationHandler';
import { IDENTITY_SECURITY_KEYS } from '../../../foundation/infrastructure/SecretStore';
import { bodyRecord, textField } from '../../../foundation/interface/Validation';
import type { OwnerAction, OwnerActionProofPayload, OwnershipProofSnapshot, OwnershipTransferInput } from '../02_domain_yewu/AccessOwnership';
import { operatorOwnershipStore } from '../04_adapters_shixian/persistence/OperatorOwnershipStore';
import { requireExpectedVersion } from './AccessOperationValues';
import { OwnerActionProof } from './OwnerActionProof';

export function operatorOwnershipActions(context: ModuleContext): OperationActions {
  const proofs = new OwnerActionProof(context.container.get(IDENTITY_SECURITY_KEYS).session);
  return {
    'access.ownership.read': async (request, database) => {
      const access = requireAccess(request);
      return { status: 200, body: await operatorOwnershipStore.ownership(database, access.membership.id) };
    },
    'access.ownership.transfers.preview': async (request, database) => {
      const access = requireAccess(request);
      const expectedVersion = requireExpectedVersion(request);
      const snapshot = await operatorOwnershipStore.createProofSnapshot(database, access.membership.id, transferInput(request), expectedVersion);
      const issued = proofs.issue(proofInput('create', request, snapshot, null));
      await operatorOwnershipStore.registerProof(database, issued.payload);
      return { status: 200, body: proofResponse(issued.proof, issued.payload) };
    },
    'access.ownership.transfers.create': async (request, database) => {
      const access = requireAccess(request);
      const expectedVersion = requireExpectedVersion(request);
      const snapshot = await operatorOwnershipStore.createProofSnapshot(database, access.membership.id, transferInput(request), expectedVersion);
      const payload = proofs.verify(request.input.headers['x-action-proof'], proofInput('create', request, snapshot, null));
      const transfer = await operatorOwnershipStore.createOwnerTransfer(database, `owner-transfer:${randomUUID()}`, payload);
      await publishOwnerEvent(database, 'access.owner.transfer.initiated', String(transfer.id), access.trace, transfer);
      return { status: 201, body: transfer, headers: { etag: `"${String(transfer.version)}"` } };
    },
    'access.ownership.transfers.accept.preview': async (request, database) => {
      const access = requireAccess(request);
      const expectedVersion = requireExpectedVersion(request);
      const transfer = request.input.path.transferid!;
      const snapshot = await operatorOwnershipStore.transferProofSnapshot(database, transfer, access.membership.id, expectedVersion, 'accept');
      const issued = proofs.issue(proofInput('accept', request, snapshot, null));
      await operatorOwnershipStore.registerProof(database, issued.payload);
      return { status: 200, body: proofResponse(issued.proof, issued.payload) };
    },
    'access.ownership.transfers.accept': async (request, database) => {
      const access = requireAccess(request);
      const expectedVersion = requireExpectedVersion(request);
      const transfer = request.input.path.transferid!;
      const snapshot = await operatorOwnershipStore.transferProofSnapshot(database, transfer, access.membership.id, expectedVersion, 'accept');
      const payload = proofs.verify(request.input.headers['x-action-proof'], proofInput('accept', request, snapshot, null));
      const accepted = await operatorOwnershipStore.acceptOwnerTransfer(database, transfer, payload);
      await publishOwnerEvent(database, 'access.owner.transferred', transfer, access.trace, {
        transfer, previousOwnerMembership: payload.sourceMembership, ownerMembership: payload.targetMembership,
        ownershipVersion: accepted.ownershipVersion,
      });
      const ownership = await operatorOwnershipStore.ownership(database, payload.targetMembership);
      return { status: 200, body: { ...ownership, transfer: accepted }, headers: { etag: `"${String(accepted.version)}"` } };
    },
    'access.ownership.transfers.cancel.preview': async (request, database) => {
      const access = requireAccess(request);
      const expectedVersion = requireExpectedVersion(request);
      const transfer = request.input.path.transferid!;
      const reason = transferReason(request);
      const snapshot = await operatorOwnershipStore.transferProofSnapshot(database, transfer, access.membership.id, expectedVersion, 'cancel');
      const issued = proofs.issue(proofInput('cancel', request, snapshot, reasonHash(reason)));
      await operatorOwnershipStore.registerProof(database, issued.payload);
      return { status: 200, body: proofResponse(issued.proof, issued.payload) };
    },
    'access.ownership.transfers.cancel': async (request, database) => {
      const access = requireAccess(request);
      const expectedVersion = requireExpectedVersion(request);
      const transfer = request.input.path.transferid!;
      const reason = transferReason(request);
      const snapshot = await operatorOwnershipStore.transferProofSnapshot(database, transfer, access.membership.id, expectedVersion, 'cancel');
      const payload = proofs.verify(request.input.headers['x-action-proof'], proofInput('cancel', request, snapshot, reasonHash(reason)));
      const cancelled = await operatorOwnershipStore.cancelOwnerTransfer(database, transfer, payload, reason);
      await publishOwnerEvent(database, 'access.owner.transfer.cancelled', transfer, access.trace, cancelled);
      return { status: 200, body: cancelled, headers: { etag: `"${String(cancelled.version)}"` } };
    },
  };
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
