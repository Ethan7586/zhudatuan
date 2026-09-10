import {
  StorefrontMemberDetailSchema,
  StorefrontMemberInviteePageSchema,
  StorefrontMemberOrderPageSchema,
  StorefrontMemberPageSchema,
} from '@shop/contract';
import {
  createFetchMemberStorefrontDetailRead,
  createFetchMemberStorefrontInviteesRead,
  createFetchMemberStorefrontMembersRead,
  createFetchMemberStorefrontOrdersRead,
} from '@shop/sdk/member';
import type { ConsoleContext } from '../../entity/session/ConsoleSession';
import { consoleRequest } from '../../shared/api/Client';
import { appConfig } from '../../shared/config/AppConfig';

const storefrontMembersRead = createFetchMemberStorefrontMembersRead(appConfig.apiBaseUrl);
const storefrontDetailRead = createFetchMemberStorefrontDetailRead(appConfig.apiBaseUrl);
const storefrontInviteesRead = createFetchMemberStorefrontInviteesRead(appConfig.apiBaseUrl);
const storefrontOrdersRead = createFetchMemberStorefrontOrdersRead(appConfig.apiBaseUrl);

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

export const storefrontMemberDetailKey = (context: ConsoleContext, membershipId: string) => Object.freeze([
  'console', context.scope.kind, context.scope.id, context.session.accessVersion,
  'member.storefront.detail.read', membershipId,
] as const);

export async function readStorefrontMemberDetail(
  context: ConsoleContext,
  membershipId: string,
  signal: AbortSignal,
) {
  return StorefrontMemberDetailSchema.parse(await storefrontDetailRead({
    path: { membershipid: membershipId },
  }, consoleRequest(context.scope, signal, context.session.accessVersion)));
}

export const storefrontMemberInviteesKey = (context: ConsoleContext, membershipId: string, cursor?: string) => Object.freeze([
  'console', context.scope.kind, context.scope.id, context.session.accessVersion,
  'member.storefront.invitees.read', membershipId, cursor ?? null, 10,
] as const);

export async function readStorefrontMemberInvitees(
  context: ConsoleContext,
  membershipId: string,
  cursor: string | undefined,
  signal: AbortSignal,
) {
  return StorefrontMemberInviteePageSchema.parse(await storefrontInviteesRead({
    path: { membershipid: membershipId },
    query: { limit: 10, ...(cursor === undefined ? {} : { cursor }) },
  }, consoleRequest(context.scope, signal, context.session.accessVersion)));
}

export const storefrontMemberOrdersKey = (context: ConsoleContext, membershipId: string, cursor?: string) => Object.freeze([
  'console', context.scope.kind, context.scope.id, context.session.accessVersion,
  'member.storefront.orders.read', membershipId, cursor ?? null, 10,
] as const);

export async function readStorefrontMemberOrders(
  context: ConsoleContext,
  membershipId: string,
  cursor: string | undefined,
  signal: AbortSignal,
) {
  return StorefrontMemberOrderPageSchema.parse(await storefrontOrdersRead({
    path: { membershipid: membershipId },
    query: { limit: 10, ...(cursor === undefined ? {} : { cursor }) },
  }, consoleRequest(context.scope, signal, context.session.accessVersion)));
}
