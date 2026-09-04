import { DomainError } from '../../../../foundation/domain/DomainError';
import type { NavigationScopeKind } from '@shop/authz';
import type { OperationTarget } from '@shop/contract';
import type { NavigationScopeValue } from '../model/NavigationContext';

export class ScopePolicy {
  select(scopes: readonly NavigationScopeValue[], requested: string | undefined, target: OperationTarget): NavigationScopeValue {
    if (requested !== undefined && (!requested.trim() || requested.length > 255)) throw new DomainError('NAVIGATION_SCOPE_DENIED');
    if (new Set(scopes.map(({ id }) => id)).size !== scopes.length) throw new Error('NAVIGATION_SCOPE_DUPLICATE');
    const eligibleKinds: readonly NavigationScopeKind[] = TARGET_SCOPE_KINDS[target];
    const eligible = scopes.filter((scope) => scope.status === 'active' && eligibleKinds.includes(scope.kind));
    const selected = requested ? eligible.find((scope) => scope.id === requested) : (eligible.find((scope) => scope.default) ?? eligible[0]);
    if (!selected) throw new DomainError('NAVIGATION_SCOPE_DENIED');
    return Object.freeze({ ...selected });
  }
}

const TARGET_SCOPE_KINDS = Object.freeze({
  console: Object.freeze(['platform', 'distributor', 'enterprise', 'mall']),
  storefront: Object.freeze(['mall']),
  miniapp: Object.freeze(['mall']),
  store: Object.freeze(['store']),
  supplier: Object.freeze(['supplier']),
} as const satisfies Readonly<Record<OperationTarget, readonly NavigationScopeKind[]>>);
