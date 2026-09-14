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
  const prefetched = await takeDocumentMemberPrefetch(context, cursor, signal);
  if (prefetched !== undefined) return prefetched;
  return MemberPageSchema.parse(await membersRead({ query: { limit: MEMBER_PAGE_LIMIT,
    ...(cursor === undefined ? {} : { cursor }) } }, consoleRequest(context.scope, signal, context.session.accessVersion)));
}

async function takeDocumentMemberPrefetch(context: ConsoleContext, cursor: string | undefined, signal: AbortSignal) {
  if (typeof window === 'undefined') return undefined;
  const slot = window.__consoleMemberPrefetch;
  delete window.__consoleMemberPrefetch;
  if (slot === undefined) return undefined;
  if (signal.aborted) {
    window.__consoleAbortDocumentPrefetch?.();
    throw signal.reason ?? new DOMException('The operation was aborted.', 'AbortError');
  }
  let rejectAbort: (cause: unknown) => void = () => undefined;
  const aborted = new Promise<never>((_resolve, reject) => { rejectAbort = reject; });
  const abort = () => {
    window.__consoleAbortDocumentPrefetch?.();
    rejectAbort(signal.reason ?? new DOMException('The operation was aborted.', 'AbortError'));
  };
  signal.addEventListener('abort', abort, { once: true });
  try {
    const value = await Promise.race([slot.promise, aborted]);
    const matches = value?.scopeKind === context.scope.kind
      && value.scopeId === context.scope.id
      && value.accessVersion === context.session.accessVersion
      && value.cursor === cursor;
    if (!matches) return undefined;
    const parsed = MemberPageSchema.safeParse(value.value);
    return parsed.success ? parsed.data : undefined;
  } finally {
    signal.removeEventListener('abort', abort);
  }
}
