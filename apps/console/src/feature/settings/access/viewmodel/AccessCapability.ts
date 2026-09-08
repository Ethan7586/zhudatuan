import {
  OP_ACCESS_OVERRIDES_MANAGE,
  OP_ACCESS_OWNERSHIP_TRANSFERS_ACCEPT,
  OP_ACCESS_OWNERSHIP_TRANSFERS_ACCEPT_PREVIEW,
  OP_ACCESS_OWNERSHIP_TRANSFERS_CANCEL,
  OP_ACCESS_OWNERSHIP_TRANSFERS_CANCEL_PREVIEW,
  OP_ACCESS_OWNERSHIP_TRANSFERS_CREATE,
  OP_ACCESS_OWNERSHIP_TRANSFERS_PREVIEW,
  OP_ACCESS_ROLES_MANAGE,
  OP_ACCESS_SCOPES_MANAGE,
} from '@shop/contract/ids';
import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import { canUseOperation } from '../../../../shared/security/OperationAccess';
import type { Ownership } from '../model/Access';

export function accessCapabilities(context: ConsoleContext, ownership: Ownership | undefined, canReadScopes: boolean, pendingActive: boolean, coolingRemaining: number) {
  const pending = ownership?.pending ?? null;
  return Object.freeze({
    role: canUseOperation(context, OP_ACCESS_ROLES_MANAGE),
    override: canUseOperation(context, OP_ACCESS_OVERRIDES_MANAGE),
    scope: canReadScopes && canUseOperation(context, OP_ACCESS_SCOPES_MANAGE),
    owner:
      ownership !== undefined &&
      ownership.mobileReady &&
      ownership.candidates.some((candidate) => candidate.mobileReady) &&
      pending === null &&
      ownership.owner.membership === context.session.membership &&
      canUseOperation(context, OP_ACCESS_OWNERSHIP_TRANSFERS_PREVIEW) &&
      canUseOperation(context, OP_ACCESS_OWNERSHIP_TRANSFERS_CREATE),
    ownerAccept:
      ownership !== undefined && pendingActive && coolingRemaining === 0 &&
      pending?.targetMembership === context.session.membership &&
      canUseOperation(context, OP_ACCESS_OWNERSHIP_TRANSFERS_ACCEPT_PREVIEW) &&
      canUseOperation(context, OP_ACCESS_OWNERSHIP_TRANSFERS_ACCEPT),
    ownerCancel:
      ownership !== undefined && pendingActive && pending?.sourceMembership === context.session.membership &&
      canUseOperation(context, OP_ACCESS_OWNERSHIP_TRANSFERS_CANCEL_PREVIEW) &&
      canUseOperation(context, OP_ACCESS_OWNERSHIP_TRANSFERS_CANCEL),
  });
}
