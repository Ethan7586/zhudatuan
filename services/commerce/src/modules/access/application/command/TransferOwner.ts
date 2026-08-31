import { DomainError } from '../../../../foundation/domain/DomainError';
import type { OperationRequest, OperationResult } from '../../../../foundation/application/OperationExecution';
import type { OperationDatabase } from '../../../../foundation/application/ModuleOperations';
import { requireAccess } from '../../../../foundation/application/ModuleOperations';
import { bodyRecord, integerField, textField } from '../../../../foundation/interface/Validation';
import { OwnerPolicy, type OwnerTransferState } from '../../domain/policy/OwnerPolicy';
import { AccessVersionService } from '../service/AccessVersionService';
import type { AccessRepository } from '../port/AccessRepository';

export class TransferOwner {
  constructor(
    private readonly repository: AccessRepository,
    private readonly versions: AccessVersionService,
    private readonly policy = new OwnerPolicy()
  ) {}

  async execute(request: OperationRequest, database: OperationDatabase): Promise<OperationResult> {
    const access = requireAccess(request);
    const body = bodyRecord(request);
    const target = textField(body, 'targetMembership');
    const reason = textField(body, 'reason', 500);
    const targetVersion = integerField(body, 'targetVersion', 1);
    const ownership = await this.repository.lockOwnership(database, access.scope.id);
    if (!ownership) throw new DomainError('RESOURCE_NOT_FOUND');
    const ids = [ownership.membership, target].sort();
    const members = await this.repository.lockMemberships(database, ids);
    const byId = new Map(members.map((membership) => [membership.id, membership]));
    const current = byId.get(ownership.membership);
    const next = byId.get(target);
    if (!current || !next) throw new DomainError('RESOURCE_NOT_FOUND');
    const state: OwnerTransferState = {
      actorMembership: access.membership.id,
      currentMembership: current.id,
      targetMembership: next.id,
      scope: ownership.scope,
      currentOrganization: current.organization,
      targetOrganization: next.organization,
      currentClient: current.client,
      targetClient: next.client,
      currentStatus: current.status,
      targetStatus: next.status,
      roleKind: ownership.roleKind,
      currentVersion: current.accessVersion,
      expectedCurrentVersion: request.input.expectedVersion ?? -1,
      targetVersion: next.accessVersion,
      expectedTargetVersion: targetVersion,
    };
    this.policy.assertTransfer(state);

    if (!(await this.repository.expireRole(database, current.id, ownership.role))) throw new DomainError('OWNER_TRANSFER_REQUIRED');
    await this.repository.assignRole(database, { membership: next.id, role: ownership.role, issuer: access.actor.id });
    const ownershipVersion = Number(ownership.version) + 1;
    if (!(await this.repository.transferOwnership(database, { scope: ownership.scope, membership: next.id, expectedVersion: ownership.version }))) throw new DomainError('VERSION_CONFLICT');

    const bumped = new Map<string, number>();
    for (const membership of ids) {
      bumped.set(membership, await this.versions.bump(database, membership, 'ownertransferred', access.trace));
    }
    await this.repository.ownerTransferred(database, { scope: ownership.scope, previous: current.id, membership: next.id, version: ownershipVersion, trace: access.trace });
    return { status: 200, body: { scope: ownership.scope, previousMembership: current.id, membership: next.id, previousAccessVersion: bumped.get(current.id)!, accessVersion: bumped.get(next.id)!, version: ownershipVersion } };
  }
}
