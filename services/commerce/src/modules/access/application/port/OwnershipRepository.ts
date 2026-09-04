import type { ReadTransactionContext, WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import type { MembershipClient, MembershipStatus } from '../../domain/model/Membership';
import type { OwnershipTransfer, OwnershipTransferState } from '../../domain/model/OwnershipTransfer';
import type { Ownership } from './AccessRepository';

export interface OwnerIdentity {
  readonly membership: string;
  readonly member: string;
  readonly principal: string;
  readonly displayName: string;
}

export interface OwnerCandidate extends OwnerIdentity {
  readonly roles: string[];
  readonly accessVersion: number;
  readonly mobileReady: boolean;
}

export interface OwnershipMember {
  readonly id: string;
  readonly organization: string;
  readonly client: MembershipClient;
  readonly status: MembershipStatus;
  readonly accessVersion: number;
  readonly mobileReady: boolean;
}

export interface FormerOwnerRole {
  readonly id: string;
  readonly name: string;
  readonly version: number;
}

export interface OwnershipTransferView {
  readonly id: string;
  readonly state: OwnershipTransferState;
  readonly sourceMembership: string;
  readonly targetMembership: string;
  readonly targetMember: string;
  readonly targetPrincipal: string;
  readonly targetDisplayName: string;
  readonly formerOwnerMode: 'retain_admin' | 'remove_admin';
  readonly formerOwnerRole: string | null;
  readonly formerOwnerRoleVersion: number | null;
  readonly coolingUntil: string;
  readonly expiresAt: string;
  readonly version: number;
}

export interface OwnershipView {
  readonly state: 'active';
  readonly version: number;
  readonly mobileReady: boolean;
  readonly owner: OwnerIdentity;
  readonly candidates: OwnerCandidate[];
  readonly formerOwnerRoles: FormerOwnerRole[];
  readonly pending: OwnershipTransferView | null;
}

export interface OwnershipImpact {
  readonly sourceMembership: string;
  readonly targetMembership: string;
  readonly ownershipVersion: number;
  readonly targetAccessVersion: number;
  readonly formerOwnerRoleVersion: number | null;
  readonly affectedPeople: number;
  readonly affectedScopes: number;
  readonly warnings: string[];
}

export interface OwnershipRepository {
  read(context: ReadTransactionContext, scope: string, membership: string): Promise<OwnershipView | null>;
  lockOwnership(context: WriteTransactionContext, scope: string): Promise<Ownership | null>;
  lockMembers(context: WriteTransactionContext, memberships: readonly string[]): Promise<readonly OwnershipMember[]>;
  roleVersion(context: ReadTransactionContext, role: string | null, scope: string): Promise<number | null>;
  impact(context: ReadTransactionContext, scope: string, memberships: readonly string[]): Promise<Readonly<{ people: number; scopes: number }>>;
  activeTransfer(context: WriteTransactionContext, scope: string, trace: string): Promise<boolean>;
  create(context: WriteTransactionContext, transfer: OwnershipTransfer, reason: string, actor: string, trace: string): Promise<OwnershipTransferView | null>;
  lockTransfer(context: WriteTransactionContext, scope: string, transfer: string): Promise<OwnershipTransfer | null>;
  accept(context: WriteTransactionContext, transfer: OwnershipTransfer, actor: string): Promise<Readonly<{ ownership: OwnershipView; transfer: OwnershipTransferView }> | null>;
  cancel(context: WriteTransactionContext, transfer: OwnershipTransfer, reason: string, actor: string): Promise<OwnershipTransferView | null>;
  expire(context: WriteTransactionContext, scope: string, transfer: string, trace: string): Promise<boolean>;
}
