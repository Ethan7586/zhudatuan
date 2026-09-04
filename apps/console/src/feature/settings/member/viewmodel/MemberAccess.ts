import { PERM_IDENTITY_REGISTRATION_RESET } from '@shop/authz/ids';
import { OP_IDENTITY_INVITATIONS_CREATE, OP_IDENTITY_MEMBERS_MANAGE, OP_IDENTITY_PASSWORD_VERIFY, OP_MEMBER_IMPORTS_CREATE } from '@shop/contract/ids';
import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import { canUseOperation } from '../../../../shared/security/OperationAccess';

export function memberAccess(context: ConsoleContext) {
  const canManage = canUseOperation(context, OP_IDENTITY_MEMBERS_MANAGE);
  const canImport = canUseOperation(context, OP_MEMBER_IMPORTS_CREATE);
  const canInvite = canUseOperation(context, OP_IDENTITY_INVITATIONS_CREATE);
  const canResetRegistration = canManage && canUseOperation(context, OP_IDENTITY_PASSWORD_VERIFY) && context.session.permissions.includes(PERM_IDENTITY_REGISTRATION_RESET) && context.session.security.hasLocalCredential;
  return Object.freeze({ canManage, canImport, canInvite, canResetRegistration });
}
