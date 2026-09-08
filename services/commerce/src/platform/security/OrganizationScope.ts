import type { Scope } from '@shop/authz';
import { DomainError } from '../error/DomainError';

const ORGANIZATION_KINDS = new Set(['platform', 'distributor', 'tenant', 'enterprise', 'mall', 'department']);

export function organizationScope(scope: Scope): string {
  if (ORGANIZATION_KINDS.has(scope.kind)) return scope.id;
  const ancestor = [...scope.path].reverse().find(({ kind }) => ORGANIZATION_KINDS.has(kind));
  if (ancestor) return ancestor.id;
  if (scope.tenant) return scope.tenant;
  throw new DomainError('SCOPE_DENIED');
}
