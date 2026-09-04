import { DomainError } from '../../../../foundation/domain/DomainError';

export interface AddressFields {
  readonly recipient: string;
  readonly mobile: string;
  readonly address: string;
  readonly region: string;
  readonly isDefault: boolean;
}

export class AddressPolicy {
  normalize(input: Readonly<{ recipient: string; mobile: string; address: string; region: string; isDefault?: boolean }>): AddressFields {
    const recipient = input.recipient.trim();
    const mobile = input.mobile.replace(/[\s-]/g, '');
    const address = input.address.trim();
    const region = input.region
      .split('/')
      .map((part) => part.trim())
      .filter(Boolean)
      .join('/');
    if (recipient.length < 1 || recipient.length > 128) invalid('recipient');
    if (!/^\+?[0-9]{7,15}$/.test(mobile)) invalid('mobile');
    if (address.length < 3 || address.length > 500) invalid('address');
    if (region.length < 2 || region.length > 64) invalid('region');
    return Object.freeze({ recipient, mobile, address, region, isDefault: input.isDefault === true });
  }

  mask(input: Pick<AddressFields, 'recipient' | 'mobile' | 'address'>) {
    return Object.freeze({
      recipient: input.recipient.length < 2 ? '*' : `${input.recipient.slice(0, 1)}${'*'.repeat(Math.min(3, input.recipient.length - 1))}`,
      mobile: `${input.mobile.slice(0, 3)}****${input.mobile.slice(-4)}`,
      address: `${input.address.slice(0, Math.min(8, input.address.length))}***`,
    });
  }
}

function invalid(field: string): never {
  throw new DomainError('VALIDATION_FAILED', { field });
}
