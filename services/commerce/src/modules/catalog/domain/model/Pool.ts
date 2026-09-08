import { DomainError } from '../../../../platform/error/DomainError';

export type PoolKind = 'global' | 'channel' | 'private' | 'markup';
export type PoolState = 'draft' | 'active' | 'disabled';

export interface PoolSnapshot {
  readonly id: string;
  readonly scope: string;
  readonly kind: PoolKind;
  readonly name: string;
  readonly state: PoolState;
  readonly version: number;
  readonly skus: readonly string[];
}

export class Pool {
  private constructor(private readonly value: PoolSnapshot) {
    validate(value);
    Object.freeze(this);
  }

  static allocate(input: Omit<PoolSnapshot, 'state' | 'version'>): Pool {
    return new Pool(freeze({ ...input, name: input.name.trim(), state: 'active', version: 1 }));
  }

  static restore(value: PoolSnapshot): Pool {
    return new Pool(freeze(value));
  }

  include(skus: readonly string[], expectedVersion: number): Pool {
    this.expect(expectedVersion);
    if (this.value.state !== 'active') throw new DomainError('LISTING_NOT_PURCHASABLE', { reason: 'POOL_NOT_ACTIVE' });
    return new Pool(freeze({ ...this.value, skus: [...new Set([...this.value.skus, ...skus])], version: this.value.version + 1 }));
  }

  disable(expectedVersion: number): Pool {
    this.expect(expectedVersion);
    return new Pool(freeze({ ...this.value, state: 'disabled', version: this.value.version + 1 }));
  }

  snapshot(): PoolSnapshot {
    return this.value;
  }

  private expect(expectedVersion: number): void {
    if (expectedVersion !== this.value.version) throw new DomainError('VERSION_CONFLICT');
  }
}

function validate(value: PoolSnapshot): void {
  if (!/^pool:[A-Za-z0-9][A-Za-z0-9.:/-]*$/.test(value.id) || !value.scope) invalid('pool');
  if (!['global', 'channel', 'private', 'markup'].includes(value.kind)) invalid('kind');
  if (value.name.length < 1 || value.name.length > 255) invalid('name');
  if (!['draft', 'active', 'disabled'].includes(value.state)) invalid('state');
  if (!Number.isSafeInteger(value.version) || value.version < 1) invalid('version');
  if (value.skus.some((item) => !/^sku:/.test(item)) || new Set(value.skus).size !== value.skus.length) invalid('skus');
}

function freeze(value: PoolSnapshot): PoolSnapshot {
  return Object.freeze({ ...value, skus: Object.freeze([...value.skus]) });
}

function invalid(field: string): never {
  throw new DomainError('VALIDATION_FAILED', { field });
}
