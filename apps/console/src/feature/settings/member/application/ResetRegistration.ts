import { OP_IDENTITY_MEMBERS_MANAGE, OP_IDENTITY_PASSWORD_VERIFY } from '@shop/contract/ids';
import { PERM_IDENTITY_REGISTRATION_RESET } from '@shop/authz/ids';
import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import { canUseOperation } from '../../../../shared/security/OperationAccess';
import type { RegistrationResetDraft } from '../model/Member';
import type { MemberPort } from '../public';

export class ResetRegistration {
  constructor(private readonly port: Pick<MemberPort, 'resetRegistration'>) {}

  execute(context: ConsoleContext, draft: RegistrationResetDraft, identity: string, signal?: AbortSignal) {
    if (!canUseOperation(context, OP_IDENTITY_MEMBERS_MANAGE) || !canUseOperation(context, OP_IDENTITY_PASSWORD_VERIFY)) throw new Error('OPERATION_ACCESS_DENIED');
    if (!context.session.permissions.includes(PERM_IDENTITY_REGISTRATION_RESET)) throw new Error('OPERATION_ACCESS_DENIED');
    if (context.session.assurance.level < 2) throw new Error('STEPUP_REQUIRED');
    if (context.session.csrf === undefined) throw new Error('CSRF_TOKEN_INVALID');
    if (!context.session.security.hasLocalCredential) throw new Error('LOCAL_CREDENTIAL_REQUIRED');
    if (!identity) throw new Error('IDEMPOTENCY_KEY_REQUIRED');
    if (!draft.member.loginIdentityBound || !draft.member.registrationResetAllowed || draft.member.membershipId === context.session.membership) throw new Error('MEMBER_REGISTRATION_RESET_PROTECTED');
    if (draft.reason.trim().length < 4 || draft.reason.trim().length > 500) throw new Error('VALIDATION_FAILED');
    if (!draft.understood || draft.confirmation !== '重置' || draft.ownerPassword.length === 0 || draft.ownerPassword.length > 128) throw new Error('VALIDATION_FAILED');
    return this.port.resetRegistration(context, draft, identity, signal);
  }
}
