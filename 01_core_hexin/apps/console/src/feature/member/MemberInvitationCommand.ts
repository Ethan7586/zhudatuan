import { createFetchIdentityInvitationsCreate } from '@shop/sdk/identity';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { consoleCommand } from '../../shared/api/Client';
import { appConfig } from '../../shared/config/AppConfig';
import { memberInvitationCommand, MemberInvitationReceiptSchema, type MemberInvitationDraft } from './MemberInvitationSchema';

const invitationsCreate = createFetchIdentityInvitationsCreate(appConfig.apiBaseUrl);

export interface MemberInvitationAuthority {
  readonly level: 'owner' | 'senior_administrator' | 'administrator';
  readonly exactOwner: boolean;
}

export function memberInvitationAvailable(context: ConsoleContext, fallback?: MemberInvitationAuthority): boolean {
  const level = context.session.governance?.level ?? fallback?.level;
  return (level === 'owner' || level === 'senior_administrator')
    && context.session.csrf !== undefined;
}

export function memberInvitationLevelAvailable(
  context: ConsoleContext,
  governanceLevel: MemberInvitationDraft['governanceLevel'],
  fallback?: MemberInvitationAuthority,
): boolean {
  if (!memberInvitationAvailable(context, fallback)) return false;
  if (governanceLevel === 'administrator') return true;
  const authority = context.session.governance ?? fallback;
  return authority?.level === 'owner' && authority.exactOwner;
}

export async function createMemberInvitation(context: ConsoleContext, draft: MemberInvitationDraft, authority?: MemberInvitationAuthority, signal?: AbortSignal) {
  const csrfToken = context.session.csrf;
  if (csrfToken === undefined) throw new Error('INVITATION_CSRF_MISSING');
  if (!memberInvitationAvailable(context, authority)) throw new Error('INVITATION_NOT_AVAILABLE');
  const command = memberInvitationCommand(draft);
  if (!memberInvitationLevelAvailable(context, command.governanceLevel, authority)) throw new Error('INVITATION_LEVEL_NOT_AVAILABLE');
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
