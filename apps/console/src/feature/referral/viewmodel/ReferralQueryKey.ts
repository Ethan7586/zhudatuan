import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { REFERRAL_PAGE_LIMIT, type ReferralSection } from '../model/Referral';
import { referralReadOperations } from '../model/ReferralOperation';

export const referralQueryKey = (context: ConsoleContext, section: ReferralSection, cursor?: string) =>
  Object.freeze(['console', context.scope.kind, context.scope.id, context.session.accessVersion, referralReadOperations[section], cursor ?? null, REFERRAL_PAGE_LIMIT] as const);
