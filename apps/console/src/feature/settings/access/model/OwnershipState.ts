import type { OperationOutputFor } from '@shop/contract';

type OwnershipTransferDto = NonNullable<OperationOutputFor<'access.ownership.read'>['pending']>;

export type OwnershipTransferState = OwnershipTransferDto['state'];
export type FormerOwnerMode = OwnershipTransferDto['formerOwnerMode'];

export interface OwnerIdentity {
  readonly membership: string;
  readonly member: string;
  readonly principal: string;
  readonly displayName: string;
}

export interface OwnerCandidate extends OwnerIdentity {
  readonly roles: readonly string[];
  readonly accessVersion: number;
  readonly mobileReady: boolean;
}

export interface FormerOwnerRole {
  readonly id: string;
  readonly name: string;
  readonly version: number;
}

export interface OwnershipTransfer {
  readonly id: string;
  readonly state: OwnershipTransferState;
  readonly sourceMembership: string;
  readonly targetMembership: string;
  readonly targetMember: string;
  readonly targetPrincipal: string;
  readonly targetDisplayName: string;
  readonly formerOwnerMode: FormerOwnerMode;
  readonly formerOwnerRole: string | null;
  readonly formerOwnerRoleVersion: number | null;
  readonly coolingUntil: string;
  readonly expiresAt: string;
  readonly version: number;
}

export interface Ownership {
  readonly state: OperationOutputFor<'access.ownership.read'>['state'];
  readonly version: number;
  readonly mobileReady: boolean;
  readonly owner: OwnerIdentity;
  readonly candidates: readonly OwnerCandidate[];
  readonly formerOwnerRoles: readonly FormerOwnerRole[];
  readonly pending: OwnershipTransfer | null;
}

export interface OwnershipImpact {
  readonly sourceMembership: string;
  readonly targetMembership: string;
  readonly ownershipVersion: number;
  readonly targetAccessVersion: number;
  readonly formerOwnerRoleVersion: number | null;
  readonly affectedPeople: number;
  readonly affectedScopes: number;
  readonly warnings: readonly string[];
}

export type OwnershipPreview =
  | Readonly<{ action: 'create'; state: OperationOutputFor<'access.ownership.transfers.preview'>['state']; formerOwnerMode: FormerOwnerMode; formerOwnerRole: string | null; coolingUntil: string; expiresAt: string; impact: OwnershipImpact }>
  | Readonly<{ action: 'accept' | 'cancel'; transfer: OwnershipTransfer; impact: OwnershipImpact; reason?: string }>;

export type OwnerChange =
  | Readonly<{ kind: 'owner'; action: 'create'; ownership: Ownership; target: OwnerCandidate; formerOwnerMode: FormerOwnerMode; formerOwnerRole: string | null; reason: string }>
  | Readonly<{ kind: 'owner'; action: 'accept'; ownership: Ownership; transfer: OwnershipTransfer }>
  | Readonly<{ kind: 'owner'; action: 'cancel'; ownership: Ownership; transfer: OwnershipTransfer; reason: string }>;
