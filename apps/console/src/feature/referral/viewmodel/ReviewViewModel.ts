import type { ReferralMember } from '../model/Referral';

export interface ReviewViewModel {
  readonly kind: 'review';
  readonly rows: readonly ReferralMember[];
  readonly canApprove: boolean;
  readonly canDisqualify: boolean;
  readonly approve: (item: ReferralMember) => void;
  readonly disqualify: (item: ReferralMember) => void;
}
export function reviewViewModel(rows: readonly ReferralMember[], canApprove: boolean, canDisqualify: boolean, approve: (item: ReferralMember) => void, disqualify: (item: ReferralMember) => void): ReviewViewModel {
  return Object.freeze({ kind: 'review', rows, canApprove, canDisqualify, approve, disqualify });
}
