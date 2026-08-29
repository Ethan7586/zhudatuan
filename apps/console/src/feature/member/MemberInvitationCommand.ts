import { createFetchIdentityInvitationsCreate } from '@shop/sdk/identity';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { consoleCommand } from '../../shared/api/Client';
import { appConfig } from '../../shared/config/AppConfig';
import {
  MemberInvitationInputSchema,
  MemberInvitationReceiptSchema,
  type MemberInvitationInput,
  type MemberInvitationReceipt,
} from './MemberInvitationSchema';

const invitationsCreate = createFetchIdentityInvitationsCreate(appConfig.apiBaseUrl);
const INVITATION_LIFETIME_MILLISECONDS = 7 * 24 * 60 * 60 * 1_000;

export function ordinaryAdminInvitationScope(context: ConsoleContext): ConsoleContext['scope'] | undefined {
  const tenant = context.scope.kind === 'tenant' ? context.scope.id : context.scope.tenant;
  const candidates = context.scopes.filter((scope) => scope.kind === 'tenant'
    && (tenant === undefined || scope.id === tenant));
  return candidates.length === 1 ? candidates[0] : undefined;
}

export async function createOrdinaryAdminInvitation(
  context: ConsoleContext,
  input: MemberInvitationInput,
  signal?: AbortSignal,
  now = new Date(),
): Promise<MemberInvitationReceipt> {
  if (context.session.csrf === undefined) throw new Error('SESSION_CSRF_REQUIRED');
  const scope = ordinaryAdminInvitationScope(context);
  if (scope === undefined) throw new Error('INVITATION_TENANT_SCOPE_REQUIRED');
  const invitation = MemberInvitationInputSchema.parse(input);
  const output = await invitationsCreate({
    body: {
      label: invitation.label,
      destination: invitation.destination,
      targetClient: 'operator',
      maxUses: 1,
      expiresAt: invitationExpiresAt(now),
    },
  }, consoleCommand(scope, {
    ...(signal === undefined ? {} : { signal }),
    accessVersion: context.session.accessVersion,
    csrfToken: context.session.csrf,
  }));
  return MemberInvitationReceiptSchema.parse(output);
}

export function invitationExpiresAt(now: Date): string {
  return new Date(now.getTime() + INVITATION_LIFETIME_MILLISECONDS).toISOString();
}
