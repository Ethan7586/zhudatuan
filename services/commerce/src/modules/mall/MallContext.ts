import type { MembershipAccess, Scope } from '@shop/authz';

export interface MallContext {
  readonly mall_id: string;
  readonly profile_version?: number;
}

export interface MallContextReference {
  readonly mall_id: string;
  readonly profile_version?: number;
}

export class ResolveMallContext {
  resolve(scope: Scope, membership: MembershipAccess, preferredMall?: string): MallContext | null {
    if (scope.kind === 'mall') return context({ mall_id: scope.id });
    const directMallIds = [...new Set(membership.grants
      .filter((grant) => grant.scope.kind === 'mall')
      .map((grant) => grant.scope.id))];
    const candidates = preferredMall === undefined
      ? directMallIds
      : directMallIds.filter((mall) => mall === preferredMall);
    return candidates.length === 1 ? context({ mall_id: candidates[0]! }) : null;
  }

  require(scope: Scope, membership: MembershipAccess, preferredMall?: string): MallContext {
    const selected = this.resolve(scope, membership, preferredMall);
    if (selected === null) throw new Error('SCOPE_DENIED');
    return selected;
  }

  restore(reference: MallContextReference): MallContext {
    return context(reference);
  }
}

function context(reference: MallContextReference): MallContext {
  if (!reference.mall_id) throw new Error('SCOPE_DENIED');
  return Object.freeze(reference.profile_version === undefined
    ? { mall_id: reference.mall_id }
    : { mall_id: reference.mall_id, profile_version: reference.profile_version });
}
