import { SCOPE_KINDS, type Scope } from '@shop/authz';
import type { OperationRequest } from '../../../foundation/application/OperationHandler';

export function numericVersion(value: string | number): number {
  const version = Number(value);
  if (!Number.isSafeInteger(version) || version < 0) throw new Error('INVALID_ACCESS_VERSION');
  return version;
}

export function canonicalScope(value: unknown): Scope | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as Readonly<Record<string, unknown>>;
  if (typeof candidate.kind !== 'string' || !(SCOPE_KINDS as readonly string[]).includes(candidate.kind)
    || typeof candidate.id !== 'string' || candidate.id.length === 0
    || (candidate.tenant !== undefined && typeof candidate.tenant !== 'string')
    || !Array.isArray(candidate.path)) return null;
  const path = candidate.path.map((item) => {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) return null;
    const ancestor = item as Readonly<Record<string, unknown>>;
    if (typeof ancestor.kind !== 'string' || !(SCOPE_KINDS as readonly string[]).includes(ancestor.kind)
      || typeof ancestor.id !== 'string' || ancestor.id.length === 0) return null;
    return { kind: ancestor.kind as Scope['kind'], id: ancestor.id };
  });
  if (path.some((ancestor) => ancestor === null)) return null;
  return {
    kind: candidate.kind as Scope['kind'], id: candidate.id,
    ...(candidate.tenant === undefined ? {} : { tenant: candidate.tenant as string }),
    path: path as Scope['path'],
  };
}

export function requireExpectedVersion(request: OperationRequest): number {
  if (request.input.expectedVersion === undefined) throw new Error('EXPECTED_VERSION_REQUIRED');
  return request.input.expectedVersion;
}
