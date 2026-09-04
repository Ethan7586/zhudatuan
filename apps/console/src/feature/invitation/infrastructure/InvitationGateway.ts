import { createFetchAccess } from '@shop/sdk/access';
import { createFetchIdentity } from '@shop/sdk/identity';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { consoleCommand, consoleRequest } from '../../../shared/api/RequestContext';
import type { InvitationFilter } from '../model/Invitation';
import type { InvitationDraft } from '../model/InvitationDraft';
import type { InvitationPort } from '../public';
import { InvitationMapper } from './InvitationMapper';

export class InvitationGateway implements InvitationPort {
  private readonly identity;
  private readonly access;
  private readonly mapper = new InvitationMapper();

  constructor(baseUrl: string) {
    this.identity = createFetchIdentity(baseUrl);
    this.access = createFetchAccess(baseUrl);
  }

  async read(context: ConsoleContext, filter: InvitationFilter, signal?: AbortSignal) {
    const value = await this.identity.invitationsRead({ query: { limit: 50, ...filter } }, consoleRequest(context.scope, signal, context.session.accessVersion));
    return this.mapper.page(value);
  }

  async memberships(context: ConsoleContext, signal?: AbortSignal) {
    return this.mapper.memberships(await this.access.centerRead({ query: { limit: 100 } }, consoleRequest(context.scope, signal, context.session.accessVersion)));
  }

  async create(context: ConsoleContext, draft: InvitationDraft, identity: string, signal?: AbortSignal) {
    const value = await this.identity.invitationsCreate(
      { body: draft },
      consoleCommand(context.scope, {
        ...(signal === undefined ? {} : { signal }),
        accessVersion: context.session.accessVersion,
        expectedVersion: context.session.accessVersion,
        idempotencyKey: identity,
        ...(context.session.csrf === undefined ? {} : { csrfToken: context.session.csrf }),
      })
    );
    return this.mapper.receipt(value);
  }

  async revoke(context: ConsoleContext, invitation: Readonly<{ id: string; version: number }>, reason: string, identity: string, signal?: AbortSignal) {
    const value = await this.identity.invitationsRevoke(
      { path: { id: invitation.id }, body: { reason } },
      consoleCommand(context.scope, {
        ...(signal === undefined ? {} : { signal }),
        accessVersion: context.session.accessVersion,
        expectedVersion: invitation.version,
        idempotencyKey: identity,
        ...(context.session.csrf === undefined ? {} : { csrfToken: context.session.csrf }),
      })
    );
    return this.mapper.revocation(value);
  }
}
