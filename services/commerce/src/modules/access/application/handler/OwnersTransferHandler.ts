import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import { DomainError } from '../../../../foundation/domain/DomainError';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { bodyRecord, integerField, textField } from '../../../../foundation/interface/Validation';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import { OwnerPolicy, type OwnerTransferState } from '../../domain/policy/OwnerPolicy';
import type { AccessAdministrationRepository } from '../port/AccessAdministrationRepository';

export class OwnersTransferHandler implements OperationHandler<'access.owners.transfer', 'write'> {
  readonly operation = 'access.owners.transfer' as const;
  readonly mode = 'write' as const;
  private readonly policy = new OwnerPolicy();
  constructor(private readonly access: AccessAdministrationRepository) {}
  async execute(input: OperationInputFor<'access.owners.transfer'>, context: WriteHandlerContext<'access.owners.transfer'>): Promise<OperationReply<OperationOutputFor<'access.owners.transfer'>>> {
    const identity = requireSession(context.security);
    const body = bodyRecord(input);
    const target = textField(body, 'targetMembership');
    textField(body, 'reason', 500);
    const targetVersion = integerField(body, 'targetVersion', 1);
    const ownership = await this.access.lockOwnership(context.transaction, identity.scope.id);
    if (!ownership) throw new DomainError('RESOURCE_NOT_FOUND');
    const ids = [ownership.membership, target].sort();
    const members = await this.access.lockMemberships(context.transaction, ids);
    const byId = new Map(members.map((membership) => [membership.id, membership]));
    const current = byId.get(ownership.membership);
    const next = byId.get(target);
    if (!current || !next) throw new DomainError('RESOURCE_NOT_FOUND');
    const state: OwnerTransferState = {
      actorMembership: identity.membership.id,
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
      expectedCurrentVersion: context.expectedVersion ?? -1,
      targetVersion: next.accessVersion,
      expectedTargetVersion: targetVersion,
    };
    this.policy.assertTransfer(state);
    if (!(await this.access.expireRole(context.transaction, current.id, ownership.role))) throw new DomainError('OWNER_TRANSFER_REQUIRED');
    await this.access.assignRole(context.transaction, { membership: next.id, role: ownership.role, issuer: identity.actor.id });
    const version = Number(ownership.version) + 1;
    if (!(await this.access.transferOwnership(context.transaction, { scope: ownership.scope, membership: next.id, expectedVersion: ownership.version }))) throw new DomainError('VERSION_CONFLICT');
    const bumped = new Map<string, number>();
    for (const membership of ids) bumped.set(membership, await this.access.bump(context.transaction, membership, 'ownertransferred', context.traceId));
    await this.access.ownerTransferred(context.transaction, { scope: ownership.scope, previous: current.id, membership: next.id, version, trace: context.traceId });
    return { status: 200, body: { scope: ownership.scope, previousMembership: current.id, membership: next.id, previousAccessVersion: bumped.get(current.id)!, accessVersion: bumped.get(next.id)!, version } };
  }
}
