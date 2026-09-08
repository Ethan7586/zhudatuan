import { DomainError } from '../../../../platform/error/DomainError';

export type ContactKind = 'primary' | 'billing' | 'operations';

export class Contact {
  readonly name: string;
  readonly phone: string | null;
  readonly email: string | null;

  constructor(
    readonly kind: ContactKind,
    input: Readonly<{ name: string; phone?: string; email?: string }>
  ) {
    this.name = input.name.trim();
    this.phone = input.phone?.trim() || null;
    this.email = input.email?.trim().toLowerCase() || null;
    if (
      this.name.length < 1 ||
      this.name.length > 128 ||
      (this.phone === null && this.email === null) ||
      (this.phone !== null && !/^\+?[0-9][0-9 -]{5,30}$/.test(this.phone)) ||
      (this.email !== null && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email))
    ) {
      throw new DomainError('PARTNER_CONTACT_INVALID');
    }
  }

  masked(): Readonly<{ name: string; phone: string | null; email: string | null }> {
    return Object.freeze({ name: maskName(this.name), phone: this.phone === null ? null : maskPhone(this.phone), email: this.email === null ? null : maskEmail(this.email) });
  }
}

function maskName(value: string): string {
  const characters = [...value];
  return characters.length === 1 ? '*' : `${characters[0]}${'*'.repeat(Math.min(3, characters.length - 1))}`;
}

function maskPhone(value: string): string {
  const compact = value.replaceAll(/[^0-9+]/g, '');
  return compact.length <= 7 ? `${compact.slice(0, 2)}***` : `${compact.slice(0, 3)}****${compact.slice(-4)}`;
}

function maskEmail(value: string): string {
  const separator = value.indexOf('@');
  return `${value.slice(0, Math.min(2, separator))}***${value.slice(separator)}`;
}
