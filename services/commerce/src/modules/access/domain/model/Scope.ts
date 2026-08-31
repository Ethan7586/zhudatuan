import { DomainError } from '../../../../foundation/domain/DomainError';
import type { PermissionEffect } from './Role';

export class Scope {
  readonly id: string;
  readonly membership: string;
  readonly kind: string;
  readonly resource: string;
  readonly path: string;
  readonly effect: PermissionEffect;
  readonly expiresAt: Date | null;

  constructor(value: Readonly<{ id: string; membership: string; kind: string; resource: string; path: string; effect: PermissionEffect; expiresAt: Date | null }>) {
    if (!value.id || !value.membership || !value.kind || !value.resource || !value.path) {
      throw new DomainError('VALIDATION_FAILED');
    }
    this.id = value.id;
    this.membership = value.membership;
    this.kind = value.kind;
    this.resource = value.resource;
    this.path = value.path;
    this.effect = value.effect;
    this.expiresAt = value.expiresAt;
    Object.freeze(this);
  }
}
