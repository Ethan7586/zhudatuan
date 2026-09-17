import { ApiError } from '@shop/sdk';
import { createFetchIdentityInvitationsCreate, createFetchIdentityInvitationsRevoke } from '@shop/sdk/identity';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { consoleCommand } from '../../shared/api/Client';
import { appConfig } from '../../shared/config/AppConfig';
import { memberInvitationCommand, MemberInvitationReceiptSchema, type MemberInvitationDraft } from './MemberInvitationSchema';

const invitationsCreate = createFetchIdentityInvitationsCreate(appConfig.apiBaseUrl);
const invitationsRevoke = createFetchIdentityInvitationsRevoke(appConfig.apiBaseUrl);

export interface ActiveMemberInvitation {
  readonly id: string;
  readonly version: number;
  readonly expiresAt: string;
  readonly destinationMasked?: string;
}

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

export function activeMemberInvitation(error: unknown): ActiveMemberInvitation | undefined {
  if (!(error instanceof ApiError) || error.code !== 'ADMINISTRATOR_INVITATION_ALREADY_ACTIVE') return undefined;
  const details = error.details;
  const id = details?.invitationId;
  const version = details?.version;
  const expiresAt = details?.expiresAt;
  const destinationMasked = details?.destinationMasked;
  if (typeof id !== 'string' || id.length === 0 || typeof version !== 'number' || !Number.isInteger(version)
    || typeof expiresAt !== 'string' || Number.isNaN(Date.parse(expiresAt))) return undefined;
  return {
    id,
    version,
    expiresAt,
    ...(typeof destinationMasked === 'string' && destinationMasked.length > 0 ? { destinationMasked } : {}),
  };
}

export async function replaceMemberInvitation(
  context: ConsoleContext,
  draft: MemberInvitationDraft,
  active: ActiveMemberInvitation,
  signal?: AbortSignal,
) {
  await revokeInvitation(context, active, '重新生成未使用管理员邀请码', signal);
  return createMemberInvitation(context, draft, signal);
}

export async function revokeMemberInvitation(
  context: ConsoleContext,
  invitation: Readonly<{ id: string; version: number }>,
  signal?: AbortSignal,
) {
  return revokeInvitation(context, invitation, '管理员删除未使用邀请码', signal);
}

function revokeInvitation(
  context: ConsoleContext,
  invitation: Readonly<{ id: string; version: number }>,
  reason: string,
  signal?: AbortSignal,
) {
  const csrfToken = context.session.csrf;
  if (csrfToken === undefined) throw new Error('INVITATION_CSRF_MISSING');
  return invitationsRevoke(
    { path: { invitationid: invitation.id }, body: { reason } },
    consoleCommand(context.scope, {
      accessVersion: context.session.accessVersion,
      csrfToken,
      expectedVersion: invitation.version,
      ...(signal === undefined ? {} : { signal }),
    }),
  );
}
