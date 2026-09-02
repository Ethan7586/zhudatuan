import { createFetchMemberInvitationsRead } from '@shop/sdk/member';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { consoleRequest } from '../../shared/api/Client';
import { appConfig } from '../../shared/config/AppConfig';
import { InvitationRecordsPageSchema } from './InvitationRecordsSchema';

const invitationsRead = createFetchMemberInvitationsRead(appConfig.apiBaseUrl);

export const invitationRecordsKey = (context: ConsoleContext) => Object.freeze([
  'console', context.scope.kind, context.scope.id, context.session.accessVersion, 'member.invitations.read',
] as const);

export function invitationRecordsAvailable(context: ConsoleContext): boolean {
  const level = context.session.governance?.level;
  return (level === 'owner' || level === 'senior_administrator')
    && context.session.permissions.includes('identity.invitation.manage')
    && context.session.capabilities.includes('member.invitations.read');
}

export async function readInvitationRecords(context: ConsoleContext, cursor: string | undefined, signal: AbortSignal) {
  return InvitationRecordsPageSchema.parse(await invitationsRead(
    { query: { limit: 50, ...(cursor === undefined ? {} : { cursor }) } },
    consoleRequest(context.scope, signal, context.session.accessVersion),
  ));
}
