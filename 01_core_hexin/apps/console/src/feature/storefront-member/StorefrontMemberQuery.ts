import { StorefrontMemberPageSchema } from '@shop/contract';
import { createFetchMemberStorefrontMembersRead } from '@shop/sdk/member';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { consoleRequest } from '../../shared/api/Client';
import { appConfig } from '../../shared/config/AppConfig';

const storefrontMembersRead = createFetchMemberStorefrontMembersRead(appConfig.apiBaseUrl);

export interface StorefrontMemberQuery {
  readonly cursor?: string;
  readonly q?: string;
}

export const storefrontMemberKey = (context: ConsoleContext, query: StorefrontMemberQuery) => Object.freeze([
  'console', context.scope.kind, context.scope.id, context.session.accessVersion,
  'member.storefront.members.read', query.q ?? '', query.cursor ?? null, 25,
] as const);

export async function readStorefrontMembers(
  context: ConsoleContext,
  query: StorefrontMemberQuery,
  signal: AbortSignal,
) {
  return StorefrontMemberPageSchema.parse(await storefrontMembersRead({
    query: {
      limit: 25,
      ...(query.q === undefined || query.q === '' ? {} : { q: query.q }),
      ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
    },
  }, consoleRequest(context.scope, signal, context.session.accessVersion)));
}
