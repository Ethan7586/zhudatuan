import type { ConsoleContext } from '../../entity/session/ConsoleSession';

export type ReferralMemberDecisionKind = 'approve' | 'disqualify';

export interface ReferralMemberDecision {
  readonly kind: ReferralMemberDecisionKind;
  readonly memberId: string;
  readonly version: number;
}

export async function decideReferralMember(context: ConsoleContext, decision: ReferralMemberDecision, signal?: AbortSignal) {
  assertDecisionAvailable(context, decision.kind);
  void signal;
  throw new Error('REFERRAL_PREVIEW_READ_ONLY');
}

function assertDecisionAvailable(context: ConsoleContext, kind: ReferralMemberDecisionKind): void {
  if (context.scope.kind !== 'mall') throw new Error('REFERRAL_REVIEW_MALL_SCOPE_REQUIRED');
  const operation = kind === 'approve' ? 'referral.members.approve' : 'referral.members.disqualify';
  if (!context.session.permissions.includes(operation) || !context.session.capabilities.includes(operation)) {
    throw new Error('REFERRAL_REVIEW_NOT_AVAILABLE');
  }
}
