import { DomainError } from '../../../../foundation/domain/DomainError';

export interface PreferenceValues {
  readonly member: string;
  readonly locale: string;
  readonly timezone: string;
  readonly marketingAllowed: boolean;
  readonly version: number;
}

export class Preference implements PreferenceValues {
  readonly member!: string;
  readonly locale!: string;
  readonly timezone!: string;
  readonly marketingAllowed!: boolean;
  readonly version!: number;

  constructor(values: PreferenceValues) {
    if (!values.member.startsWith('member:')) invalid('memberId');
    if (!/^[a-z]{2}(?:-[A-Z]{2})?$/.test(values.locale)) invalid('locale');
    try {
      new Intl.DateTimeFormat(values.locale, { timeZone: values.timezone }).format(new Date(0));
    } catch {
      invalid('timezone');
    }
    if (!Number.isSafeInteger(values.version) || values.version < 0) invalid('version');
    Object.assign(this, values);
    Object.freeze(this);
  }

  revise(input: Readonly<{ locale: string; timezone: string; marketingAllowed: boolean }>): Preference {
    return new Preference({ ...this, ...input, version: this.version + 1 });
  }
}

function invalid(field: string): never {
  throw new DomainError('VALIDATION_FAILED', { field });
}
