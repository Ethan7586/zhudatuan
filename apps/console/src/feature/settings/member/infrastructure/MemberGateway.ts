import { createIdempotencyKey } from '@shop/sdk/context';
import { createFetchIdentity, type IdentityOperations } from '@shop/sdk/identity';
import { createFetchMember, type MemberOperations } from '@shop/sdk/member';
import type { ConsoleContext } from '../../../../entity/session/ConsoleSession';
import { consoleCommand, consoleRequest } from '../../../../shared/api/RequestContext';
import type { MemberChange, MemberImportSource, RegistrationResetDraft } from '../model/Member';
import type { MemberPort } from '../public';
import { MemberMapper } from './MemberMapper';
import { ImportUploadGateway } from '../../../../shared/import/ImportUploadGateway';

export class MemberGateway implements MemberPort {
  private readonly member: MemberOperations;
  private readonly identity: IdentityOperations;
  private readonly mapper = new MemberMapper();
  private readonly uploads: ImportUploadGateway;
  constructor(baseUrl: string) {
    this.member = createFetchMember(baseUrl);
    this.identity = createFetchIdentity(baseUrl);
    this.uploads = new ImportUploadGateway(baseUrl);
  }

  async read(context: ConsoleContext, cursor?: string, signal?: AbortSignal) {
    return this.mapper.page(await this.member.membersRead({ query: { limit: 50, ...(cursor === undefined ? {} : { cursor }) } }, consoleRequest(context.scope, signal, context.session.accessVersion)));
  }

  async manage(context: ConsoleContext, change: MemberChange, identity: string, signal?: AbortSignal) {
    const body = change.kind === 'profile'
      ? { action: 'update' as const, displayName: change.displayName.trim(), reason: change.reason.trim() }
      : { action: change.status === 'active' ? 'enable' as const : change.status === 'left' ? 'offboard' as const : 'disable' as const, reason: change.reason.trim() };
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

  async resetRegistration(context: ConsoleContext, draft: RegistrationResetDraft, identity: string, signal?: AbortSignal) {
    const request = {
      accessVersion: context.session.accessVersion,
      ...(context.session.csrf === undefined ? {} : { csrfToken: context.session.csrf }),
      ...(signal === undefined ? {} : { signal }),
    };
    const verified = await this.identity.passwordVerify(
      { body: { password: draft.ownerPassword } },
      consoleCommand(context.scope, { ...request, idempotencyKey: createIdempotencyKey() })
    );
    if (!verified.verified) throw new Error('MEMBER_REGISTRATION_RESET_PASSWORD_UNVERIFIED');
    const value = await this.identity.membersManage(
      { path: { membershipid: draft.member.membershipId }, body: { action: 'registrationReset', reason: draft.reason.trim() } },
      consoleCommand(context.scope, { ...request, expectedVersion: draft.member.accessVersion, idempotencyKey: identity })
    );
    return this.mapper.registrationReset(value);
  }

  async createImport(context: ConsoleContext, source: MemberImportSource, identity: string, signal?: AbortSignal) {
    const uploaded = await this.uploads.upload(context, source.file, signal, undefined, identity);
    const value = await this.member.importsCreate(
      { body: { objectRef: uploaded.objectRef, sha256: uploaded.sha256, fileName: uploaded.fileName } },
      consoleCommand(context.scope, { accessVersion: context.session.accessVersion, idempotencyKey: identity, ...(context.session.csrf === undefined ? {} : { csrfToken: context.session.csrf }), ...(signal === undefined ? {} : { signal }) })
    );
    return this.mapper.importTask(value);
  }

  createIdentity(): string {
    return createIdempotencyKey();
  }
}
