import { createFetchIdentityInvitationsCreate } from '@shop/sdk/identity';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { consoleCommand } from '../../shared/api/Client';
import { appConfig } from '../../shared/config/AppConfig';
import { memberInvitationCommand, MemberInvitationReceiptSchema, type MemberInvitationDraft } from './MemberInvitationSchema';

const invitationsCreate = createFetchIdentityInvitationsCreate(appConfig.apiBaseUrl);

export function memberInvitationAvailable(context: ConsoleContext): boolean {
  const level = context.session.governance?.level;
  return (level === 'owner' || level === 'senior_administrator')
    && context.session.csrf !== undefined;
}

export function memberInvitationLevelAvailable(
  context: ConsoleContext,
  governanceLevel: MemberInvitationDraft['governanceLevel'],
): boolean {
  if (!memberInvitationAvailable(context)) return false;
  if (governanceLevel === 'administrator') return true;
  return context.session.governance?.level === 'owner';
}

export async function createMemberInvitation(context: ConsoleContext, draft: MemberInvitationDraft, signal?: AbortSignal) {
  const csrfToken = context.session.csrf;
  if (csrfToken === undefined) throw new Error('INVITATION_CSRF_MISSING');
  if (!memberInvitationAvailable(context)) throw new Error('INVITATION_NOT_AVAILABLE');
  const command = memberInvitationCommand(draft);
  if (!memberInvitationLevelAvailable(context, command.governanceLevel)) throw new Error('INVITATION_LEVEL_NOT_AVAILABLE');
  const body = command.tenantId === undefined
    ? { label: command.label, destination: command.destination, targetClient: command.targetClient, governanceLevel: command.governanceLevel, maxUses: command.maxUses, expiresAt: command.expiresAt }
    : { label: command.label, destination: command.destination, targetClient: command.targetClient, governanceLevel: command.governanceLevel, maxUses: command.maxUses, expiresAt: command.expiresAt, tenantId: command.tenantId };
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
