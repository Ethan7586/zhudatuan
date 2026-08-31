export type DirectoryMembershipStatus = 'active' | 'inactive' | 'pending' | 'conflict';
export interface DirectoryMembershipValue {
  readonly id: string;
  readonly connectionid: string;
  readonly subjectid: string;
  readonly organizationid: string;
  readonly membershipid: string | null;
  readonly status: DirectoryMembershipStatus;
  readonly effectiveat: string;
  readonly expiresat: string | null;
  readonly sourceversion: number;
  readonly version: number;
}
export class DirectoryMembership implements DirectoryMembershipValue {
  readonly id: string;
  readonly connectionid: string;
  readonly subjectid: string;
  readonly organizationid: string;
  readonly membershipid: string | null;
  readonly status: DirectoryMembershipStatus;
  readonly effectiveat: string;
  readonly expiresat: string | null;
  readonly sourceversion: number;
  readonly version: number;
  constructor(value: DirectoryMembershipValue) {
    const effective = Date.parse(value.effectiveat);
    const expires = value.expiresat === null ? null : Date.parse(value.expiresat);
    if (
      !['active', 'inactive', 'pending', 'conflict'].includes(value.status) ||
      Number.isNaN(effective) ||
      (expires !== null && (Number.isNaN(expires) || expires <= effective)) ||
      !Number.isSafeInteger(value.sourceversion) ||
      value.sourceversion < 0 ||
      !Number.isSafeInteger(value.version) ||
      value.version < 0
    ) {
      throw new Error('DIRECTORY_MEMBERSHIP_INVALID');
    }
    this.id = value.id;
    this.connectionid = value.connectionid;
    this.subjectid = value.subjectid;
    this.organizationid = value.organizationid;
    this.membershipid = value.membershipid;
    this.status = value.status;
    this.effectiveat = value.effectiveat;
    this.expiresat = value.expiresat;
    this.sourceversion = value.sourceversion;
    this.version = value.version;
    Object.freeze(this);
  }
}
