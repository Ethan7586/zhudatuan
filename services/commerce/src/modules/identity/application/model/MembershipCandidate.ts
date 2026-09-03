import type { IdentityMembership } from '../../../access/public/IdentityAccessPort';

export interface MembershipCandidate {
  readonly id: string;
  readonly target: 'console' | 'storefront';
  readonly accessVersion: number;
  readonly displayName: string;
  readonly organizationName: string;
  readonly scopeKind: string;
  readonly scopeId: string;
  readonly roleLabel: string;
  readonly logoUrl: string | null;
}

export type MembershipView = Omit<MembershipCandidate, 'accessVersion'>;

export function membershipCandidate(value: IdentityMembership): MembershipCandidate {
  return Object.freeze({
    id: value.id,
    target: value.target,
    accessVersion: value.accessVersion,
    displayName: value.displayName,
    organizationName: value.organizationName,
    scopeKind: value.scopeKind,
    scopeId: value.scopeId,
    roleLabel: value.roleLabel,
    logoUrl: value.logoUrl,
  });
}


export function membershipView(value: MembershipCandidate): MembershipView {
  return Object.freeze({
    id: value.id,
    target: value.target,
    displayName: value.displayName,
    organizationName: value.organizationName,
    scopeKind: value.scopeKind,
    scopeId: value.scopeId,
    roleLabel: value.roleLabel,
    logoUrl: value.logoUrl,
  });
}
