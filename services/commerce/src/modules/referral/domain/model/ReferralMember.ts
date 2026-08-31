import { DomainError } from '../../../../foundation/domain/DomainError';

export type ReferralMemberState = 'applied' | 'active' | 'disqualified';

export class ReferralMember {
  constructor(
    readonly id: string,
    readonly scopeId: string,
    readonly memberId: string,
    readonly state: ReferralMemberState,
    readonly version: number,
    readonly makerId: string
  ) {
    if (!id || !scopeId || !memberId || !makerId || !Number.isSafeInteger(version) || version < 0) throw new Error('REFERRAL_MEMBER_INVALID');
    Object.freeze(this);
  }

  approve(checkerId: string): ReferralMember {
    if (this.state !== 'applied' || checkerId === this.makerId) throw new DomainError('MAKER_CHECKER_SEPARATION_REQUIRED');
    return new ReferralMember(this.id, this.scopeId, this.memberId, 'active', this.version + 1, this.makerId);
  }

  disqualify(checkerId: string): ReferralMember {
    if (this.state !== 'active' || checkerId === this.makerId) throw new DomainError('MAKER_CHECKER_SEPARATION_REQUIRED');
    return new ReferralMember(this.id, this.scopeId, this.memberId, 'disqualified', this.version + 1, this.makerId);
  }
}
