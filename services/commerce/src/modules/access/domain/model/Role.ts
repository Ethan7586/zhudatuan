import { ACCESS_ROLE_TEMPLATE_CODES, type AccessRoleTemplateCode } from '@shop/contract';
import { DomainError } from '../../../../foundation/domain/DomainError';

export type RoleKind = 'custom' | 'system' | 'owner';
export type PermissionEffect = 'allow' | 'deny';
export type RoleTemplateCode = AccessRoleTemplateCode;

export interface RolePermissionDiff {
  readonly addedAllows: string[];
  readonly removedAllows: string[];
  readonly addedDenies: string[];
  readonly removedDenies: string[];
  readonly affectedPeople: number;
  readonly affectedScopes: number;
}

export class Role {
  readonly id: string;
  readonly scope: string;
  readonly name: string;
  readonly description: string;
  readonly status: 'active' | 'disabled';
  readonly version: number;
  readonly kind: RoleKind;
  readonly template: RoleTemplateCode | null;

  constructor(value: Readonly<{ id: string; scope: string; name: string; description?: string; status: string; version: number; kind: RoleKind; template?: RoleTemplateCode | null }>) {
    if (!value.id || !value.scope || !value.name || !Number.isSafeInteger(value.version) || value.version < 0 || (value.status !== 'active' && value.status !== 'disabled')) throw new DomainError('VALIDATION_FAILED');
    this.id = value.id;
    this.scope = value.scope;
    this.name = value.name;
    this.description = value.description ?? '';
    this.status = value.status;
    this.version = value.version;
    this.kind = value.kind;
    this.template = value.template ?? null;
    Object.freeze(this);
  }

  permissionDiff(
    current: Readonly<{ allows: readonly string[]; denies: readonly string[] }>,
    next: Readonly<{ allows: readonly string[]; denies: readonly string[] }>,
    impact: Readonly<{ people: number; scopes: number }>
  ): RolePermissionDiff {
    if (next.allows.some((permission) => next.denies.includes(permission))) throw new DomainError('ACCESS_GRANT_CONFLICT');
    if (![impact.people, impact.scopes].every((value) => Number.isSafeInteger(value) && value >= 0)) throw new DomainError('VALIDATION_FAILED');
    return Object.freeze({
      addedAllows: difference(next.allows, current.allows),
      removedAllows: difference(current.allows, next.allows),
      addedDenies: difference(next.denies, current.denies),
      removedDenies: difference(current.denies, next.denies),
      affectedPeople: impact.people,
      affectedScopes: impact.scopes,
    });
  }
}

function difference(left: readonly string[], right: readonly string[]): string[] {
  const existing = new Set(right);
  return [...new Set(left)].filter((value) => !existing.has(value)).sort();
}

export function isRoleTemplateCode(value: unknown): value is RoleTemplateCode {
  return typeof value === 'string' && (ACCESS_ROLE_TEMPLATE_CODES as readonly string[]).includes(value);
}
