import { DomainError } from '../../../../platform/error/DomainError';

export type ProductKind = 'physical' | 'virtual' | 'service' | 'voucher';
export type ProductState = 'draft' | 'review' | 'active' | 'archived';

export interface ProductSnapshot {
  readonly id: string;
  readonly scope: string;
  readonly owner: string | null;
  readonly brand: string | null;
  readonly category: string;
  readonly title: string;
  readonly kind: ProductKind;
  readonly attributes: Readonly<Record<string, unknown>>;
  readonly state: ProductState;
  readonly version: number;
}

export class Product {
  private constructor(private readonly value: ProductSnapshot) {
    validate(value);
    Object.freeze(this);
  }

  static create(input: Omit<ProductSnapshot, 'state' | 'version'>): Product {
    return new Product(freeze({ ...input, title: input.title.trim(), state: 'draft', version: 1 }));
  }

  static restore(value: ProductSnapshot): Product {
    return new Product(freeze(value));
  }

  change(input: Readonly<{ title?: string; category?: string; attributes?: Readonly<Record<string, unknown>>; state?: ProductState }>, expectedVersion: number): Product {
    this.expect(expectedVersion);
    if (this.value.state === 'archived') invalid('state', 'PRODUCT_ARCHIVED');
    const state = input.state ?? this.value.state;
    if (state === 'archived') return this.archive(expectedVersion);
    return new Product(
      freeze({
        ...this.value,
        title: input.title?.trim() ?? this.value.title,
        category: input.category ?? this.value.category,
        attributes: input.attributes ?? this.value.attributes,
        state,
        version: this.value.version + 1,
      })
    );
  }

  archive(expectedVersion: number): Product {
    this.expect(expectedVersion);
    if (this.value.state === 'archived') return this;
    return new Product(freeze({ ...this.value, state: 'archived', version: this.value.version + 1 }));
  }

  snapshot(): ProductSnapshot {
    return this.value;
  }

  private expect(expectedVersion: number): void {
    if (!Number.isSafeInteger(expectedVersion) || expectedVersion !== this.value.version) throw new DomainError('VERSION_CONFLICT');
  }
}

function validate(value: ProductSnapshot): void {
  if (!/^product:[A-Za-z0-9][A-Za-z0-9.:/-]*$/.test(value.id)) invalid('productId');
  if (!value.scope || value.scope.length > 255) invalid('scope');
  if (value.owner !== null && !/^partner:/.test(value.owner)) invalid('owner');
  if (!/^category:/.test(value.category)) invalid('category');
  if (value.title.length < 1 || value.title.length > 300) invalid('title');
  if (!['physical', 'virtual', 'service', 'voucher'].includes(value.kind)) invalid('kind');
  if (!['draft', 'review', 'active', 'archived'].includes(value.state)) invalid('state');
  if (!Number.isSafeInteger(value.version) || value.version < 1) invalid('version');
  if (Array.isArray(value.attributes) || value.attributes === null || typeof value.attributes !== 'object') invalid('attributes');
}

function freeze(value: ProductSnapshot): ProductSnapshot {
  return Object.freeze({ ...value, attributes: Object.freeze({ ...value.attributes }) });
}

function invalid(field: string, reason?: string): never {
  throw new DomainError('VALIDATION_FAILED', { field, ...(reason ? { reason } : {}) });
}
