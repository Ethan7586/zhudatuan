import { DomainError } from '../../../../platform/error/DomainError';

export class SeparationPolicy {
  assertPermissions(rules: readonly Readonly<{ left: string; right: string }>[], allows: readonly string[], denies: readonly string[] = []): void {
    const granted = new Set(allows.filter((permission) => !denies.includes(permission)));
    if (rules.some(({ left, right }) => granted.has(left) && granted.has(right))) throw new DomainError('ACCESS_SEPARATION_REQUIRED');
  }

  assertActors(maker: string, checker: string): void {
    if (!maker || maker === checker) throw new DomainError('MAKER_CHECKER_SEPARATION_REQUIRED');
  }
}
