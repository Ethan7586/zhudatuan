import type { ExperienceTheme } from '@shop/contract';
import { DomainError } from '../../../../platform/error/DomainError';

export class Theme {
  private constructor(private readonly value: ExperienceTheme) {
    validate(value);
    Object.freeze(this);
  }

  static create(value: ExperienceTheme): Theme {
    return new Theme(Object.freeze({ ...value }));
  }

  snapshot(): ExperienceTheme {
    return this.value;
  }
}

function validate(value: ExperienceTheme): void {
  if (!['shop', 'market', 'governance'].includes(value.preset)) invalid('theme.preset');
  if (!/^#[0-9A-F]{6}$/.test(value.primaryColor) || !/^#[0-9A-F]{6}$/.test(value.accentColor)) invalid('theme.color');
  for (const [field, reference] of [
    ['logoObjectRef', value.logoObjectRef],
    ['faviconObjectRef', value.faviconObjectRef],
  ] as const) {
    if (reference !== null && !/^[a-z][a-z0-9]*:[A-Za-z0-9][A-Za-z0-9.:/_-]{1,510}$/.test(reference)) invalid(`theme.${field}`);
  }
}

function invalid(field: string): never {
  throw new DomainError('VALIDATION_FAILED', { field });
}
