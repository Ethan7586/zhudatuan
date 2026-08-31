import { DomainError } from '../../../../foundation/domain/DomainError';

export type MembershipClient = 'console' | 'storefront';
export type MembershipStatus = 'invited' | 'active' | 'suspended' | 'left';

export class Membership {
  readonly id: string;
  readonly organization: string;
  readonly client: MembershipClient;
  readonly status: MembershipStatus;
  readonly accessVersion: number;

  constructor(value: Readonly<{ id: string; organization: string; client: string; status: string; accessVersion: number }>) {
    if (!value.id || !value.organization || !Number.isSafeInteger(value.accessVersion) || value.accessVersion < 0) {
      throw new DomainError('VALIDATION_FAILED');
    }
    const status = membershipStatus(value.status);
    this.id = value.id;
    this.organization = value.organization;
    this.client = value.client === 'storefront' ? 'storefront' : 'console';
    this.status = status;
    this.accessVersion = value.accessVersion;
    Object.freeze(this);
  }
}

function membershipStatus(value: string): MembershipStatus {
  if (value === 'invited' || value === 'active' || value === 'suspended' || value === 'left') return value;
  throw new DomainError('VALIDATION_FAILED', { field: 'status' });
}
