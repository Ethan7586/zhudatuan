import { DomainError } from '../../../../foundation/domain/DomainError';
import type { NavigationScope } from '../../../organization/public';

export class ScopePolicy {
  select(scopes: readonly NavigationScope[], requested: string | undefined, target: 'console' | 'storefront'): NavigationScope {
    const eligible = scopes.filter((scope) => scope.status === 'active' && (target === 'console' || scope.kind === 'mall'));
    const selected = requested ? eligible.find((scope) => scope.id === requested) : (eligible.find((scope) => scope.default) ?? eligible[0]);
    if (!selected) throw new DomainError('NAVIGATION_SCOPE_DENIED');
    return selected;
  }
}
