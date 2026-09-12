import { createFetchMemberMembersRead } from '@shop/sdk/member';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { consoleRequest } from '../../shared/api/Client';
import { appConfig } from '../../shared/config/AppConfig';
import { MemberPageSchema } from './MemberSchema';

const membersRead = createFetchMemberMembersRead(appConfig.apiBaseUrl);
export const MEMBER_PAGE_LIMIT = 20;
export const MEMBER_PREFETCH_STALE_TIME_MS = 30_000;

export const memberPartitionKey = (context: ConsoleContext) => Object.freeze([
  'console', 'member.members.read', context.session.actor, context.session.membership, context.session.syncedAt,
  context.scope.kind, context.scope.id, context.session.accessVersion,
] as const);

export const memberKey = (context: ConsoleContext, cursor?: string) => Object.freeze([
  ...memberPartitionKey(context), cursor ?? null, MEMBER_PAGE_LIMIT,
] as const);
export function belongsToMemberPartition(queryKey: readonly unknown[] | undefined, context: ConsoleContext): boolean {
  const partition = memberPartitionKey(context);
  return queryKey !== undefined && partition.every((value, index) => queryKey[index] === value);
}
export async function readMembers(context: ConsoleContext, cursor: string | undefined, signal: AbortSignal) {
  return MemberPageSchema.parse(await membersRead({ query: { limit: MEMBER_PAGE_LIMIT,
    ...(cursor === undefined ? {} : { cursor }) } }, consoleRequest(context.scope, signal, context.session.accessVersion)));
}
