import { OP_ACCESS_CENTER_READ, OP_IDENTITY_INVITATIONS_READ } from '@shop/contract/ids';
import type { MutableRefObject } from 'react';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import type { InvitationFilter } from '../model/Invitation';

export interface CommandIdentity {
  fingerprint: string;
  identity: string;
}

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
    ...(target === 'console' || target === 'storefront' ? { target } : {}),
    ...(kind === 'signin' || kind === 'enrollment' || kind === 'campaign' ? { kind } : {}),
    ...(status === 'draft' || status === 'active' || status === 'exhausted' || status === 'revoked' || status === 'expired' ? { status } : {}),
    ...(cursor ? { cursor } : {}),
  });
}

export function identityFor(reference: MutableRefObject<CommandIdentity | undefined>, fingerprint: string, create: () => string): string {
  if (reference.current?.fingerprint !== fingerprint) reference.current = { fingerprint, identity: create() };
  return reference.current.identity;
}
