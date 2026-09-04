import { DomainError } from '../../../../foundation/domain/DomainError';

export type CustomerKind = 'enterprise' | 'institution' | 'government';
export type CustomerState = 'draft' | 'active' | 'disabled';

export class Customer {
  readonly name: string;

  constructor(
    readonly id: string,
    readonly kind: CustomerKind,
    name: string,
    readonly state: CustomerState,
    readonly version: number
  ) {
    this.name = name.trim();
    if (!/^partnercustomer:[A-Za-z0-9][A-Za-z0-9.:/-]*$/.test(id) || this.name.length < 2 || this.name.length > 160 || !Number.isSafeInteger(version) || version < 0) {
      throw new DomainError('VALIDATION_FAILED');
    }
  }

  enable(hasEffectiveAgreement: boolean): CustomerState {
    if (this.state === 'active') return this.state;
    if (!hasEffectiveAgreement || (this.state !== 'draft' && this.state !== 'disabled')) throw new DomainError('PARTNER_CUSTOMER_STATE_INVALID');
    return 'active';
  }

  disable(): CustomerState {
    if (this.state !== 'active') throw new DomainError('PARTNER_CUSTOMER_STATE_INVALID');
    return 'disabled';
  }
}
