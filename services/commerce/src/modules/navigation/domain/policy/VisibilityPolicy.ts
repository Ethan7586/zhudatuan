import type { NavigationContext } from '../model/NavigationContext';

export interface VisibilityCandidate {
  readonly permissions: readonly string[];
  readonly capabilities: readonly string[];
}

export class VisibilityPolicy {
  allows(candidate: VisibilityCandidate, context: NavigationContext): boolean {
    return (
      context.membershipActive && context.scope.status === 'active' && candidate.permissions.every((permission) => context.permissions.has(permission)) && candidate.capabilities.every((capability) => context.capabilities.has(capability))
    );
  }
}
