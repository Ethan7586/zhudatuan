import { createFetchReferralMembersApprove, createFetchReferralMembersDisqualify } from '@shop/sdk/referral';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { consoleCommand } from '../../shared/api/Client';
import { appConfig } from '../../shared/config/AppConfig';
import { ReferralMemberDecisionReceiptSchema } from './ReferralSchema';

const membersApprove = createFetchReferralMembersApprove(appConfig.apiBaseUrl);
const membersDisqualify = createFetchReferralMembersDisqualify(appConfig.apiBaseUrl);

export type ReferralMemberDecisionKind = 'approve' | 'disqualify';

export interface ReferralMemberDecision {
  readonly kind: ReferralMemberDecisionKind;
  readonly memberId: string;
  readonly version: number;
}

export async function decideReferralMember(context: ConsoleContext, decision: ReferralMemberDecision, signal?: AbortSignal) {
  assertDecisionAvailable(context, decision.kind);
  const csrfToken = context.session.csrf;
  if (csrfToken === undefined) throw new Error('REFERRAL_REVIEW_CSRF_MISSING');
  const request = consoleCommand(context.scope, {
    accessVersion: context.session.accessVersion,
    expectedVersion: decision.version,
    csrfToken,
    ...(signal === undefined ? {} : { signal }),
  });
  const input = { body: { member: decision.memberId } };
  const value = decision.kind === 'approve' ? await membersApprove(input, request) : await membersDisqualify(input, request);
  return ReferralMemberDecisionReceiptSchema.parse(value);
}

function assertDecisionAvailable(context: ConsoleContext, kind: ReferralMemberDecisionKind): void {
  if (context.scope.kind !== 'mall') throw new Error('REFERRAL_REVIEW_MALL_SCOPE_REQUIRED');
  const operation = kind === 'approve' ? 'referral.members.approve' : 'referral.members.disqualify';
  if (!context.session.permissions.includes(operation) || !context.session.capabilities.includes(operation)) {
    throw new Error('REFERRAL_REVIEW_NOT_AVAILABLE');
  }
}
