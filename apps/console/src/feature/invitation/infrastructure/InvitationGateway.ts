import type { IdentityInvitationsCreateBody } from '@shop/contract';
import { createFetchAccessCenterRead } from '@shop/sdk/access';
import { createFetchIdentityInvitationsCreate, createFetchIdentityInvitationsRead, createFetchIdentityInvitationsRevoke } from '@shop/sdk/identity';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { consoleCommand, consoleRequest } from '../../../shared/api/Client';
import { appConfig } from '../../../shared/config/AppConfig';
import type { InvitationFilter, InvitationPage, InvitationReceipt, InvitationRevocation } from '../model/Invitation';

const readOperation = createFetchIdentityInvitationsRead(appConfig.apiBaseUrl);
const createOperation = createFetchIdentityInvitationsCreate(appConfig.apiBaseUrl);
const revokeOperation = createFetchIdentityInvitationsRevoke(appConfig.apiBaseUrl);
const accessOperation = createFetchAccessCenterRead(appConfig.apiBaseUrl);

export interface InvitationMembership {
  readonly id: string;
  readonly client: 'console' | 'storefront';
}

export interface InvitationMembershipPage {
  readonly items: readonly InvitationMembership[];
  readonly count: number;
  readonly nextCursor?: string;
}

export class InvitationGateway {
  read(context: ConsoleContext, filter: InvitationFilter, signal: AbortSignal): Promise<InvitationPage> {
    return readOperation(
      { query: { limit: 50, ...filter } },
      consoleRequest(context.scope, signal, context.session.accessVersion)
    );
  }

  memberships(context: ConsoleContext, signal: AbortSignal): Promise<InvitationMembershipPage> {
    return accessOperation({ query: { limit: 100 } }, consoleRequest(context.scope, signal, context.session.accessVersion)) as Promise<InvitationMembershipPage>;
  }

  create(context: ConsoleContext, body: IdentityInvitationsCreateBody, idempotencyKey: string, signal?: AbortSignal): Promise<InvitationReceipt> {
    return createOperation(
      { body },
      consoleCommand(context.scope, {
        ...(signal === undefined ? {} : { signal }),
        accessVersion: context.session.accessVersion,
        expectedVersion: context.session.accessVersion,
        idempotencyKey,
        ...(context.session.csrf === undefined ? {} : { csrfToken: context.session.csrf }),
      })
    );
  }

  revoke(context: ConsoleContext, id: string, version: number, reason: string, idempotencyKey: string, signal?: AbortSignal): Promise<InvitationRevocation> {
    return revokeOperation(
      { path: { id }, body: { reason } },
      consoleCommand(context.scope, {
        ...(signal === undefined ? {} : { signal }),
        accessVersion: context.session.accessVersion,
        expectedVersion: version,
        idempotencyKey,
        ...(context.session.csrf === undefined ? {} : { csrfToken: context.session.csrf }),
      })
    );
  }
}
