import { createIdempotencyKey } from '@shop/sdk/context';
import { createFetchIdentity, type IdentityOperations } from '@shop/sdk/identity';
import { createFetchMember, type MemberOperations } from '@shop/sdk/member';
import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import { consoleCommand, consoleRequest } from '../../../../shared/api/RequestContext';
import type { MemberChange, MemberImportSource } from '../model/Member';
import type { MemberPort } from '../public';
import { MemberMapper } from './MemberMapper';

export class MemberGateway implements MemberPort {
  private readonly member: MemberOperations;
  private readonly identity: IdentityOperations;
  private readonly mapper = new MemberMapper();
  constructor(baseUrl: string) {
    this.member = createFetchMember(baseUrl);
    this.identity = createFetchIdentity(baseUrl);
  }

  async read(context: ConsoleContext, cursor?: string, signal?: AbortSignal) {
    return this.mapper.page(await this.member.membersRead({ query: { limit: 50, ...(cursor === undefined ? {} : { cursor }) } }, consoleRequest(context.scope, signal, context.session.accessVersion)));
  }

  async manage(context: ConsoleContext, change: MemberChange, identity: string, signal?: AbortSignal) {
    const body = change.kind === 'profile' ? { action: 'update' as const, displayName: change.displayName.trim(), reason: change.reason.trim() } : { action: 'status' as const, status: change.status, reason: change.reason.trim() };
    const value = await this.identity.membersManage(
      { path: { membershipid: change.member.membershipId }, body },
      consoleCommand(context.scope, {
        accessVersion: context.session.accessVersion,
        expectedVersion: change.member.accessVersion,
        idempotencyKey: identity,
        ...(context.session.csrf === undefined ? {} : { csrfToken: context.session.csrf }),
        ...(signal === undefined ? {} : { signal }),
      })
    );
    return this.mapper.receipt(value);
  }

  async createImport(context: ConsoleContext, source: MemberImportSource, identity: string, signal?: AbortSignal) {
    const value = await this.member.importsCreate(
      { body: { objectRef: source.objectRef, sha256: source.sha256 } },
      consoleCommand(context.scope, { accessVersion: context.session.accessVersion, idempotencyKey: identity, ...(context.session.csrf === undefined ? {} : { csrfToken: context.session.csrf }), ...(signal === undefined ? {} : { signal }) })
    );
    return this.mapper.importTask(value);
  }

  createIdentity(): string {
    return createIdempotencyKey();
  }
}
