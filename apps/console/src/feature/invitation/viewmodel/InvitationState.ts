import { OP_ACCESS_CENTER_READ, OP_IDENTITY_INVITATIONS_READ } from '@shop/contract/ids';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { InvitationFilter } from '../model/Invitation';
import { isOperationTarget } from '@shop/contract';

export { identityFor, type CommandIdentity } from '../../../shared/action/CommandIdentity';

export function invitationQueryKey(context: ConsoleContext, filter: InvitationFilter) {
  return Object.freeze(['console', context.scope.kind, context.scope.id, context.session.accessVersion, OP_IDENTITY_INVITATIONS_READ, filter] as const);
}

export function invitationMembershipKey(context: ConsoleContext) {
  return Object.freeze(['console', context.scope.kind, context.scope.id, context.session.accessVersion, OP_ACCESS_CENTER_READ, 100] as const);
}

export function readFilter(search: URLSearchParams): InvitationFilter {
  const target = search.get('target');
  const kind = search.get('kind');
  const status = search.get('status');
  const cursor = search.get('cursor');
  return Object.freeze({
    ...(isOperationTarget(target) ? { target } : {}),
    ...(kind === 'signin' || kind === 'enrollment' || kind === 'campaign' ? { kind } : {}),
    ...(status === 'draft' || status === 'active' || status === 'exhausted' || status === 'revoked' || status === 'expired' ? { status } : {}),
    ...(cursor ? { cursor } : {}),
  });
}
