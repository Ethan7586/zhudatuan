import { createFetchIdentityInvitationsCreate } from '@shop/sdk/identity';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { consoleCommand } from '../../shared/api/Client';
import { appConfig } from '../../shared/config/AppConfig';
import { memberInvitationCommand, MemberInvitationReceiptSchema, type MemberInvitationDraft } from './MemberInvitationSchema';

const invitationsCreate = createFetchIdentityInvitationsCreate(appConfig.apiBaseUrl);

export function memberInvitationAvailable(context: ConsoleContext): boolean {
  const level = context.session.governance?.level;
  return (level === 'owner' || level === 'senior_administrator')
    && context.session.permissions.includes('identity.invitation.manage')
    && context.session.capabilities.includes('identity.invitations.create')
    && context.session.csrf !== undefined;
}

export async function createMemberInvitation(context: ConsoleContext, draft: MemberInvitationDraft, signal?: AbortSignal) {
  const csrfToken = context.session.csrf;
  if (csrfToken === undefined) throw new Error('INVITATION_CSRF_MISSING');
  if (!memberInvitationAvailable(context)) throw new Error('INVITATION_NOT_AVAILABLE');
  const command = memberInvitationCommand(draft);
  const body = command.tenantId === undefined
    ? { label: command.label, destination: command.destination, targetClient: command.targetClient, maxUses: command.maxUses, expiresAt: command.expiresAt }
    : { label: command.label, destination: command.destination, targetClient: command.targetClient, maxUses: command.maxUses, expiresAt: command.expiresAt, tenantId: command.tenantId };
  const value = await invitationsCreate(
    { body },
    consoleCommand(context.scope, {
      accessVersion: context.session.accessVersion,
      csrfToken,
      ...(signal === undefined ? {} : { signal }),
    })
  );
  return MemberInvitationReceiptSchema.parse(value);
}
