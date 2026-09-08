import { DomainError } from '../../../../platform/error/DomainError';

export type PartnerState = 'pending' | 'active' | 'suspended' | 'terminated';

export class Partner {
  constructor(
    readonly id: string,
    readonly state: PartnerState
  ) {
    if (!/^[a-z][a-z0-9]*:[A-Za-z0-9][A-Za-z0-9.:/-]*$/.test(id) || !['pending', 'active', 'suspended', 'terminated'].includes(state)) throw new DomainError('VALIDATION_FAILED');
  }

  assertAcceptsNewBusiness(): void {
    if (this.state !== 'active') throw new DomainError('PARTNER_CUSTOMER_STATE_INVALID');
  }
}
