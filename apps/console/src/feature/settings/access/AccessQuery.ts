import { createFetchAccessCenterRead } from '@shop/sdk/access';
import { createFetchIdentityInvitationsCreate, createFetchIdentityInvitationsRead, createFetchIdentityInvitationsRevoke } from '@shop/sdk/identity';
import type { IdentityInvitationsCreateBody } from '@shop/contract';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { consoleCommand, consoleRequest } from '../../../shared/api/Client';
import { appConfig } from '../../../shared/config/AppConfig';
import { AccessPageSchema, InvitationCreatedSchema, InvitationPageSchema, InvitationRevokedSchema } from './AccessSchema';

const centerRead = createFetchAccessCenterRead(appConfig.apiBaseUrl);
const invitationRead = createFetchIdentityInvitationsRead(appConfig.apiBaseUrl);
const invitationCreate = createFetchIdentityInvitationsCreate(appConfig.apiBaseUrl);
const invitationRevoke = createFetchIdentityInvitationsRevoke(appConfig.apiBaseUrl);

export const accessKey = (context: ConsoleContext, cursor?: string) => Object.freeze(['console', context.scope.kind, context.scope.id, context.session.accessVersion, 'access.center.read', cursor ?? null, 50] as const);
export async function readAccess(context: ConsoleContext, cursor: string | undefined, signal: AbortSignal) {
  return AccessPageSchema.parse(await centerRead({ query: { limit: 50, ...(cursor === undefined ? {} : { cursor }) } }, consoleRequest(context.scope, signal, context.session.accessVersion)));
}

export interface InvitationFilters {
  readonly target: 'console' | 'storefront';
  readonly status: 'active' | 'exhausted' | 'revoked' | 'expired' | null;
  readonly kind: 'signin' | 'enrollment' | 'campaign' | null;
  readonly cursor?: string;
}

export const invitationKey = (context: ConsoleContext, filter: InvitationFilters) =>
  Object.freeze(['console', 'identity.invitations.read', filter.target, context.scope.id, context.session.accessVersion, filter.status, filter.kind, filter.cursor ?? null, 50] as const);

export async function readInvitations(context: ConsoleContext, filter: InvitationFilters, signal: AbortSignal) {
  const response = await invitationRead(
    { query: { limit: 50, target: filter.target, ...(filter.status === null ? {} : { status: filter.status }), ...(filter.kind === null ? {} : { kind: filter.kind }), ...(filter.cursor === undefined ? {} : { cursor: filter.cursor }) } },
    consoleRequest(context.scope, signal, context.session.accessVersion)
  );
  return InvitationPageSchema.parse(response);
}

export type CreateInvitationInput = IdentityInvitationsCreateBody;

export async function createInvitation(context: ConsoleContext, input: CreateInvitationInput, signal?: AbortSignal) {
  const body: IdentityInvitationsCreateBody = {
    kind: input.kind,
    target: input.target,
    expiresAt: input.expiresAt,
    reason: input.reason,
    ...(input.membershipId === undefined ? {} : { membershipId: input.membershipId }),
    ...(input.organizationId === undefined ? {} : { organizationId: input.organizationId }),
    ...(input.recipient === undefined ? {} : { recipient: input.recipient }),
    ...(input.maxUses === undefined ? {} : { maxUses: input.maxUses }),
  };
  const response = await invitationCreate(
    { body },
    consoleCommand(context.scope, {
      ...(signal === undefined ? {} : { signal }),
      accessVersion: context.session.accessVersion,
      expectedVersion: context.session.accessVersion,
      ...(context.session.csrf === undefined ? {} : { csrfToken: context.session.csrf }),
    })
  );
  return InvitationCreatedSchema.parse(response);
}

export async function revokeInvitation(context: ConsoleContext, id: string, version: number, reason: string, signal?: AbortSignal) {
  const response = await invitationRevoke(
    { path: { id }, body: { reason } },
    consoleCommand(context.scope, { ...(signal === undefined ? {} : { signal }), accessVersion: context.session.accessVersion, expectedVersion: version, ...(context.session.csrf === undefined ? {} : { csrfToken: context.session.csrf }) })
  );
  return InvitationRevokedSchema.parse(response);
}
