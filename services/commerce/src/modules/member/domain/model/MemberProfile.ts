import { DomainError } from '../../../../platform/error/DomainError';

export type MemberState = 'pending' | 'active' | 'disabled';

export interface MemberProfileValues {
  readonly id: string;
  readonly principal: string;
  readonly displayName: string;
  readonly state: MemberState;
  readonly version: number;
}

export class MemberProfile implements MemberProfileValues {
  readonly id: string;
  readonly principal: string;
  readonly displayName: string;
  readonly state: MemberState;
  readonly version: number;

  constructor(values: MemberProfileValues) {
    if (!values.id.startsWith('member:')) invalid('memberId');
    if (!values.principal.startsWith('principal:')) invalid('principalId');
    const displayName = values.displayName.trim();
    if (displayName.length < 1 || displayName.length > 128) invalid('displayName');
    if (!['pending', 'active', 'disabled'].includes(values.state)) invalid('status');
    if (!Number.isSafeInteger(values.version) || values.version < 0) invalid('version');
    this.id = values.id;
    this.principal = values.principal;
    this.displayName = displayName;
    this.state = values.state;
    this.version = values.version;
    Object.freeze(this);
  }

  activate(displayName: string): MemberProfile {
    if (this.state !== 'pending') throw new DomainError('MEMBERSHIP_NOT_INVITED');
    return new MemberProfile({ ...this, displayName, state: 'active', version: this.version + 1 });
  }

  rename(displayName: string): MemberProfile {
    if (this.state === 'disabled') throw new DomainError('RESOURCE_NOT_FOUND');
    return new MemberProfile({ ...this, displayName, version: this.version + 1 });
  }

  disable(): MemberProfile {
    if (this.state === 'disabled') return this;
    return new MemberProfile({ ...this, state: 'disabled', version: this.version + 1 });
  }
}

function invalid(field: string): never {
  throw new DomainError('VALIDATION_FAILED', { field });
}
