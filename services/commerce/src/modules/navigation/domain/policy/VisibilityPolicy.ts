import type { NavigationScopeKind } from '@shop/authz';
import type { OperationTarget } from '@shop/contract';
import type { NavigationContext } from '../model/NavigationContext';

export type VisibilityReason = 'visible' | 'membership' | 'scope' | 'client' | 'permission' | 'capability' | 'feature';

export interface VisibilityCandidate {
  readonly surface: OperationTarget;
  readonly scope: NavigationScopeKind;
  readonly permission: string | null;
  readonly capability: string;
  readonly featureFlags: readonly string[];
}

export class VisibilityPolicy {
  decide(candidate: VisibilityCandidate, context: NavigationContext): VisibilityReason {
    if (!context.membershipActive) return 'membership';
    if (context.scope.status !== 'active' || candidate.scope !== context.scopeKind) return 'scope';
    if (candidate.surface !== context.target) return 'client';
    if (candidate.permission !== null && !context.permissions.has(candidate.permission)) return 'permission';
    if (!context.capabilities.has(candidate.capability)) return 'capability';
    if (candidate.featureFlags.some((flag) => !context.featureFlags.has(flag))) return 'feature';
    return 'visible';
  }

  allows(candidate: VisibilityCandidate, context: NavigationContext): boolean {
    return this.decide(candidate, context) === 'visible';
  }
}
