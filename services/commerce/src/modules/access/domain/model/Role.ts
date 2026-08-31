import { DomainError } from '../../../../foundation/domain/DomainError';

export type RoleKind = 'custom' | 'system' | 'owner';
export type PermissionEffect = 'allow' | 'deny';

export class Role {
  readonly id: string;
  readonly scope: string;
  readonly name: string;
  readonly status: 'active' | 'disabled';
  readonly version: number;
  readonly kind: RoleKind;

  constructor(value: Readonly<{ id: string; scope: string; name: string; status: string; version: number; kind: RoleKind }>) {
    if (!value.id || !value.scope || !value.name || !Number.isSafeInteger(value.version) || value.version < 0 || (value.status !== 'active' && value.status !== 'disabled')) throw new DomainError('VALIDATION_FAILED');
    this.id = value.id;
    this.scope = value.scope;
    this.name = value.name;
    this.status = value.status;
    this.version = value.version;
    this.kind = value.kind;
    Object.freeze(this);
  }
}
