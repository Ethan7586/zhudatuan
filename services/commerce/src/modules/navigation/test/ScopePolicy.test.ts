import { describe, expect, it } from 'vitest';
import type { NavigationScope } from '../../organization/public';
import { ScopePolicy } from '../domain/policy/ScopePolicy';

describe('ScopePolicy', () => {
  it('selects each granted platform, distributor, enterprise and mall scope for console', () => {
    const scopes = ['platform', 'distributor', 'enterprise', 'mall'].map((kind, index) => scope(kind as NavigationScope['kind'], index));
    const policy = new ScopePolicy();
    for (const candidate of scopes) expect(policy.select(scopes, candidate.id, 'console')).toEqual(candidate);
  });

  it('rejects inactive, foreign-client, duplicate and ungranted scopes', () => {
    const active = scope('enterprise', 1);
    const inactive = { ...scope('mall', 2), status: 'disabled' as const };
    const policy = new ScopePolicy();
    expect(() => policy.select([active, inactive], inactive.id, 'console')).toThrow('NAVIGATION_SCOPE_DENIED');
    expect(() => policy.select([active], active.id, 'storefront')).toThrow('NAVIGATION_SCOPE_DENIED');
    expect(() => policy.select([active, active], active.id, 'console')).toThrow('NAVIGATION_SCOPE_DUPLICATE');
    expect(() => policy.select([active], 'enterprise:absent', 'console')).toThrow('NAVIGATION_SCOPE_DENIED');
  });
});

function scope(kind: NavigationScope['kind'], index: number): NavigationScope {
  return Object.freeze({ membership: 'membership:one', id: `${kind}:${index}`, kind, status: 'active', version: 1, default: index === 0 });
}
