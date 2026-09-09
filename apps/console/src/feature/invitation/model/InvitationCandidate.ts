import { canDelegatePermissions } from '@shop/authz';
import { PERM_ACCESS_ROLE_DELEGATE, PERM_ACCESS_SCOPE_DELEGATE } from '@shop/authz/ids';
import type { InvitationMembership } from './Invitation';

const DELEGATION_PERMISSIONS = Object.freeze([PERM_ACCESS_ROLE_DELEGATE, PERM_ACCESS_SCOPE_DELEGATE]);
const NO_DENIES = new Set<string>();

export function invitationCandidates(memberships: readonly InvitationMembership[], actor: string, permissions: readonly string[]): readonly InvitationMembership[] {
  const issuer = new Set(permissions);
  if (!canDelegatePermissions(issuer, NO_DENIES, DELEGATION_PERMISSIONS)) return Object.freeze([]);
  return Object.freeze(
    memberships.filter((membership) => {
      if (membership.id === actor || membership.status !== 'active' || membership.mobileMasked === null || membership.roles.length === 0) return false;
      if (membership.roles.some(({ kind }) => kind === 'owner')) return false;
      return canDelegatePermissions(issuer, NO_DENIES, delegatedPermissions(membership));
    })
  );
}

function delegatedPermissions(membership: InvitationMembership): readonly string[] {
  const effects = new Map<string, boolean>();
  for (const role of membership.roles) {
    if (role.kind !== 'custom') continue;
    for (const permission of role.allows) if (!effects.has(permission)) effects.set(permission, true);
    for (const permission of role.denies) effects.set(permission, false);
  }
  return Object.freeze([...effects].filter(([, allowed]) => allowed).map(([permission]) => permission));
}
