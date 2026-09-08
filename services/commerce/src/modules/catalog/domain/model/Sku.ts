import { DomainError } from '../../../../platform/error/DomainError';

export type SkuState = 'draft' | 'active' | 'archived';

export interface SkuSnapshot {
  readonly id: string;
  readonly product: string;
  readonly code: string;
  readonly specifications: Readonly<Record<string, string>>;
  readonly state: SkuState;
  readonly version: number;
}

export class Sku {
  private constructor(private readonly value: SkuSnapshot) {
    validate(value);
    Object.freeze(this);
  }

  static create(input: Omit<SkuSnapshot, 'state' | 'version'>): Sku {
    return new Sku(freeze({ ...input, code: Sku.normalizeCode(input.code), state: 'draft', version: 1 }));
  }

  static normalizeCode(value: string): string {
    const code = value.trim().toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9./:-]{0,127}$/.test(code)) invalid('code');
    return code;
  }

  static restore(value: SkuSnapshot): Sku {
    return new Sku(freeze(value));
  }

  activate(expectedVersion: number): Sku {
    this.expect(expectedVersion);
    if (this.value.state === 'archived') throw new DomainError('LISTING_NOT_PURCHASABLE', { reason: 'SKU_ARCHIVED' });
    return new Sku(freeze({ ...this.value, state: 'active', version: this.value.version + 1 }));
  }

  archive(expectedVersion: number): Sku {
    this.expect(expectedVersion);
    return new Sku(freeze({ ...this.value, state: 'archived', version: this.value.version + 1 }));
  }

  snapshot(): SkuSnapshot {
    return this.value;
  }

  private expect(expectedVersion: number): void {
    if (expectedVersion !== this.value.version) throw new DomainError('VERSION_CONFLICT');
  }
}

function validate(value: SkuSnapshot): void {
  if (!/^sku:[A-Za-z0-9][A-Za-z0-9.:/-]*$/.test(value.id) || !/^product:/.test(value.product)) invalid('sku');
  if (!/^[A-Z0-9][A-Z0-9./:-]{0,127}$/.test(value.code)) invalid('code');
  if (!['draft', 'active', 'archived'].includes(value.state)) invalid('state');
  if (!Number.isSafeInteger(value.version) || value.version < 1) invalid('version');
  if (Object.keys(value.specifications).length > 50 || Object.values(value.specifications).some((item) => typeof item !== 'string' || item.length > 255)) invalid('specifications');
}

function freeze(value: SkuSnapshot): SkuSnapshot {
  return Object.freeze({ ...value, specifications: Object.freeze({ ...value.specifications }) });
}

function invalid(field: string): never {
  throw new DomainError('VALIDATION_FAILED', { field });
}
