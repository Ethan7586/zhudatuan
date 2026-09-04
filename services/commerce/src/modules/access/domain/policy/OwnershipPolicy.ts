import { DomainError } from '../../../../foundation/domain/DomainError';
import type { OwnershipTransfer, FormerOwnerMode } from '../model/OwnershipTransfer';

interface OwnershipPolicyState {
  readonly scope: string;
  readonly role: string;
  readonly membership: string;
  readonly version: number;
  readonly roleKind: string;
}

interface OwnershipPolicyMember {
  readonly id: string;
  readonly organization: string;
  readonly client: string;
  readonly status: string;
  readonly accessVersion: number;
  readonly mobileReady: boolean;
}

export class OwnershipPolicy {
  assertDraft(input: Readonly<{ actor: string; source: OwnershipPolicyMember; target: OwnershipPolicyMember; ownership: OwnershipPolicyState; expectedVersion: number; targetVersion: number; mode: FormerOwnerMode; formerRole: string | null }>): void {
    if (
      input.ownership.roleKind !== 'owner' ||
      input.actor !== input.ownership.membership ||
      input.source.id !== input.ownership.membership ||
      !input.source.mobileReady ||
      input.target.id === input.ownership.membership ||
      input.target.organization !== input.ownership.scope ||
      input.target.client !== 'console' ||
      input.target.status !== 'active' ||
      !input.target.mobileReady ||
      input.ownership.version !== input.expectedVersion ||
      input.target.accessVersion !== input.targetVersion ||
      (input.mode === 'retain_admin') !== (input.formerRole !== null)
    ) {
      throw new DomainError(input.ownership.version !== input.expectedVersion || input.target.accessVersion !== input.targetVersion ? 'VERSION_CONFLICT' : 'OWNER_TRANSFER_REQUIRED');
    }
  }

  assertAccept(transfer: OwnershipTransfer, actor: OwnershipPolicyMember, ownership: OwnershipPolicyState, expectedVersion: number): void {
    if (actor.id !== transfer.targetMembership || actor.status !== 'active' || actor.client !== 'console' || actor.organization !== transfer.scope || !actor.mobileReady) throw new DomainError('OWNER_TRANSFER_REQUIRED');
    if (ownership.membership !== transfer.sourceMembership || ownership.version !== transfer.ownershipVersion || actor.accessVersion !== transfer.targetAccessVersion || transfer.version !== expectedVersion) throw new DomainError('VERSION_CONFLICT');
  }

  assertCancel(transfer: OwnershipTransfer, actor: string, expectedVersion: number): void {
    if (actor !== transfer.sourceMembership) throw new DomainError('OWNER_TRANSFER_REQUIRED');
    if (transfer.version !== expectedVersion) throw new DomainError('VERSION_CONFLICT');
  }
}
