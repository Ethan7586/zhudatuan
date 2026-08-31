import { createFetchMemberMembersRead } from '@shop/sdk/member';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { consoleRequest } from '../../../shared/api/Client';
import { appConfig } from '../../../shared/config/AppConfig';
import { MemberPageSchema } from './MemberSchema';

const membersRead = createFetchMemberMembersRead(appConfig.apiBaseUrl);

export const memberKey = (context: ConsoleContext, cursor?: string) => Object.freeze(['console', context.scope.kind, context.scope.id, context.session.accessVersion, 'member.members.read', cursor ?? null, 50] as const);
export async function readMembers(context: ConsoleContext, cursor: string | undefined, signal: AbortSignal) {
  return MemberPageSchema.parse(await membersRead({ query: { limit: 50, ...(cursor === undefined ? {} : { cursor }) } }, consoleRequest(context.scope, signal, context.session.accessVersion)));
}
