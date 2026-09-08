import { DomainError } from '../../../../platform/error/DomainError';

export type MembershipResponsibility = 'owner' | 'manager' | 'member';
export type MembershipStatus = 'active' | 'inactive';

export interface MembershipValue {
  readonly id: string;
  readonly organizationid: string;
  readonly sourcemembershipid: string;
  readonly responsibility: MembershipResponsibility;
  readonly status: MembershipStatus;
  readonly version: number;
  readonly createdat: string;
  readonly updatedat: string;
}

export class Membership implements MembershipValue {
  readonly id: string;
  readonly organizationid: string;
  readonly sourcemembershipid: string;
  readonly responsibility: MembershipResponsibility;
  readonly status: MembershipStatus;
  readonly version: number;
  readonly createdat: string;
  readonly updatedat: string;

  constructor(value: MembershipValue) {
    if (!value.id.startsWith('organizationmembership:') || !value.organizationid || value.sourcemembershipid.length < 3) invalid('ownerMembershipId');
    if (!['owner', 'manager', 'member'].includes(value.responsibility) || !['active', 'inactive'].includes(value.status)) invalid('membership');
    if (!Number.isSafeInteger(value.version) || value.version < 1) invalid('version');
    if (!Number.isFinite(Date.parse(value.createdat)) || !Number.isFinite(Date.parse(value.updatedat)) || Date.parse(value.updatedat) < Date.parse(value.createdat)) invalid('updatedAt');
    this.id = value.id;
    this.organizationid = value.organizationid;
    this.sourcemembershipid = value.sourcemembershipid;
    this.responsibility = value.responsibility;
    this.status = value.status;
    this.version = value.version;
    this.createdat = value.createdat;
    this.updatedat = value.updatedat;
    Object.freeze(this);
  }

  static owner(id: string, organization: string, source: string, now: string): Membership {
    return new Membership({ id, organizationid: organization, sourcemembershipid: source, responsibility: 'owner', status: 'active', version: 1, createdat: now, updatedat: now });
  }
}

function invalid(field: string): never {
  throw new DomainError('VALIDATION_FAILED', { field });
}
