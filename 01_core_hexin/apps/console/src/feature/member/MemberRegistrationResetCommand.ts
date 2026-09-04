import { createFetchIdentityMembersReset, createFetchIdentityPasswordVerify } from '@shop/sdk/identity';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { consoleCommand } from '../../shared/api/Client';
import { appConfig } from '../../shared/config/AppConfig';
import type { Member } from './MemberSchema';
import {
  MemberPasswordVerificationReceiptSchema,
  MemberRegistrationResetDraftSchema,
  MemberRegistrationResetReceiptSchema,
  type MemberRegistrationResetDraft,
} from './MemberRegistrationResetSchema';

const passwordVerify = createFetchIdentityPasswordVerify(appConfig.apiBaseUrl);
const membersReset = createFetchIdentityMembersReset(appConfig.apiBaseUrl);

export async function resetMemberRegistration(
  context: ConsoleContext,
  target: Member,
  value: MemberRegistrationResetDraft,
  signal?: AbortSignal,
) {
  const csrfToken = context.session.csrf;
  if (csrfToken === undefined) throw new Error('MEMBER_RESET_CSRF_MISSING');
  if (!context.session.permissions.includes('identity.registration.reset') || !context.session.capabilities.includes('identity.members.reset')) {
    throw new Error('MEMBER_RESET_NOT_AVAILABLE');
  }
  if (!target.reset_allowed || !target.login_identity_bound || target.principal_id === context.session.actor) {
    throw new Error('MEMBER_RESET_TARGET_PROTECTED');
  }
  const draft = MemberRegistrationResetDraftSchema.parse(value);
  const requestOptions = {
    accessVersion: context.session.accessVersion,
    csrfToken,
    ...(signal === undefined ? {} : { signal }),
  };
  MemberPasswordVerificationReceiptSchema.parse(
    await passwordVerify({ body: { password: draft.ownerPassword } }, consoleCommand(context.scope, requestOptions))
  );
  const receipt = await membersReset(
    { path: { membershipid: target.membership_id }, body: { reason: draft.reason } },
    consoleCommand(context.scope, { ...requestOptions, expectedVersion: target.principal_version })
  );
  return MemberRegistrationResetReceiptSchema.parse(receipt);
}
