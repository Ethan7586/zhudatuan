import { DomainError } from '../../../../foundation/domain/DomainError';
import { isOperationTarget, type OperationTarget } from '@shop/contract';

export type MembershipClient = OperationTarget;
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
    this.client = membershipClient(value.client);
    this.status = status;
    this.accessVersion = value.accessVersion;
    Object.freeze(this);
  }
}

function membershipClient(value: string): MembershipClient {
  const target = value === 'operator' ? 'console' : value;
  if (!isOperationTarget(target) || target === 'miniapp') throw new DomainError('VALIDATION_FAILED', { field: 'client' });
  return target;
}

function membershipStatus(value: string): MembershipStatus {
  if (value === 'invited' || value === 'active' || value === 'suspended' || value === 'left') return value;
  throw new DomainError('VALIDATION_FAILED', { field: 'status' });
}
