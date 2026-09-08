import { DomainError } from '../../../../platform/error/DomainError';

export type CategoryState = 'active' | 'disabled';

export interface CategorySnapshot {
  readonly id: string;
  readonly parent: string | null;
  readonly code: string;
  readonly name: string;
  readonly state: CategoryState;
  readonly sort: number;
}

export class Category {
  private constructor(private readonly value: CategorySnapshot) {
    validate(value);
    Object.freeze(this);
  }

  static restore(value: CategorySnapshot): Category {
    return new Category(Object.freeze({ ...value }));
  }

  active(): CategorySnapshot {
    if (this.value.state !== 'active') throw new DomainError('VALIDATION_FAILED', { field: 'category', reason: 'CATEGORY_DISABLED' });
    return this.value;
  }

  snapshot(): CategorySnapshot {
    return this.value;
  }
}

function validate(value: CategorySnapshot): void {
  if (!/^category:[A-Za-z0-9][A-Za-z0-9.:/-]*$/.test(value.id)) invalid('id');
  if (value.parent !== null && !/^category:/.test(value.parent)) invalid('parent');
  if (!/^[A-Za-z0-9][A-Za-z0-9./:-]{0,127}$/.test(value.code)) invalid('code');
  if (value.name.trim().length < 1 || value.name.length > 255) invalid('name');
  if (!['active', 'disabled'].includes(value.state)) invalid('state');
  if (!Number.isSafeInteger(value.sort)) invalid('sort');
}

function invalid(field: string): never {
  throw new DomainError('VALIDATION_FAILED', { field });
}
