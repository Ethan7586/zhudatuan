import { createFetchIdentityMembersManage } from '@shop/sdk/identity';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { consoleCommand } from '../../../shared/api/Client';
import { appConfig } from '../../../shared/config/AppConfig';
import type { Member } from './MemberSchema';

const membersManage = createFetchIdentityMembersManage(appConfig.apiBaseUrl);

export type MemberChange = Readonly<{ kind: 'profile'; member: Member; displayName: string; reason: string }> | Readonly<{ kind: 'status'; member: Member; status: 'active' | 'suspended' | 'left'; reason: string }>;

export async function executeMemberChange(context: ConsoleContext, change: MemberChange, signal?: AbortSignal) {
  if (context.session.assurance.level < 2) throw new Error('STEPUP_REQUIRED');
  if (context.session.csrf === undefined) throw new Error('CSRF_TOKEN_INVALID');
  const request = consoleCommand(context.scope, {
    accessVersion: context.session.accessVersion,
    expectedVersion: change.member.access_version,
    csrfToken: context.session.csrf,
    ...(signal === undefined ? {} : { signal }),
  });
  const body = change.kind === 'profile' ? { action: 'update' as const, displayName: change.displayName.trim(), reason: change.reason.trim() } : { action: 'status' as const, status: change.status, reason: change.reason.trim() };
  return membersManage({ path: { membershipid: change.member.membership_id }, body }, request);
}
