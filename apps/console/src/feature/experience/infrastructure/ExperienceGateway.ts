import { createFetchExperience, type ExperienceOperations } from '@shop/sdk/experience';
import type { ConsoleContext } from '../../../entity/session/ConsoleSession';
import { consoleCommand, consoleRequest } from '../../../shared/api/RequestContext';
import { EXPERIENCE_PAGE_LIMIT, type ApplicationDraft, type ApplicationUpdate, type VersionDraft } from '../model/Experience';
import type { ExperiencePort } from '../public';
import { ExperienceMapper } from './ExperienceMapper';

export class ExperienceGateway implements ExperiencePort {
  private readonly mapper = new ExperienceMapper();
  private readonly client: ExperienceOperations;

  constructor(baseUrl: string) {
    this.client = createFetchExperience(baseUrl);
  }

  async applications(context: ConsoleContext, cursor?: string, signal?: AbortSignal) {
    const value = await this.client.applicationsRead({ query: { limit: EXPERIENCE_PAGE_LIMIT, ...(cursor === undefined ? {} : { cursor }) } }, consoleRequest(context.scope, signal, context.session.accessVersion));
    return this.mapper.page(value);
  }

  async application(context: ConsoleContext, application: string, signal?: AbortSignal) {
    return this.mapper.detail(await this.client.applicationsDetailRead({ path: { applicationid: application } }, consoleRequest(context.scope, signal, context.session.accessVersion)));
  }

  async create(context: ConsoleContext, draft: ApplicationDraft, identity: string, signal?: AbortSignal) {
    return this.mapper.application(await this.client.applicationsCreate({ body: { code: draft.code, publicSlug: draft.publicSlug, name: draft.name } }, command(context, identity, { ...(signal ? { signal } : {}) })));
  }

  async copy(context: ConsoleContext, application: string, draft: ApplicationDraft, reason: string, identity: string, signal?: AbortSignal) {
    return this.mapper.copied(
      await this.client.applicationsCopy({ path: { applicationid: application }, body: { code: draft.code, publicSlug: draft.publicSlug, name: draft.name, reason } }, command(context, identity, { ...(signal ? { signal } : {}) }))
    );
  }

  async update(context: ConsoleContext, application: string, version: number, change: ApplicationUpdate, identity: string, signal?: AbortSignal) {
    return this.mapper.application(
      await this.client.applicationsUpdate({ path: { applicationid: application }, body: { name: change.name, status: change.status } }, command(context, identity, { expectedVersion: version, ...(signal ? { signal } : {}) }))
    );
  }

  async saveVersion(context: ConsoleContext, draft: VersionDraft, identity: string, signal?: AbortSignal) {
    const configuration = {
      version: 2 as const,
      application: draft.configuration.application,
      pages: draft.configuration.pages.map((page) => ({
        id: page.id,
        path: page.path,
        blocks: page.blocks.map((block) => ({ id: block.id, component: block.component, content: { ...block.content }, ...(block.action === undefined ? {} : { action: { ...block.action } }) })),
      })),
    };
    return this.mapper.version(await this.client.versionsSave({ path: { applicationid: draft.application }, body: { schemaVersion: 2, configuration, reason: draft.reason } }, command(context, identity, { ...(signal ? { signal } : {}) })));
  }

  async validateVersion(context: ConsoleContext, version: string, identity: string, signal?: AbortSignal) {
    return this.mapper.validation(await this.client.versionsValidate({ path: { versionid: version }, body: {} }, command(context, identity, { ...(signal ? { signal } : {}) })));
  }

  async publishVersion(context: ConsoleContext, version: string, applicationVersion: number, proof: string, identity: string, signal?: AbortSignal) {
    return this.mapper.publication(await this.client.versionsPublish({ path: { versionid: version }, body: {} }, command(context, identity, { expectedVersion: applicationVersion, proof, ...(signal ? { signal } : {}) })));
  }

  async restoreVersion(context: ConsoleContext, version: string, reason: string, proof: string, identity: string, signal?: AbortSignal) {
    return this.mapper.version(await this.client.versionsRestore({ path: { versionid: version }, body: { reason } }, command(context, identity, { proof, ...(signal ? { signal } : {}) })));
  }
}

function command(context: ConsoleContext, identity: string, options: Readonly<{ expectedVersion?: number; proof?: string; signal?: AbortSignal }>) {
  return consoleCommand(context.scope, {
    accessVersion: context.session.accessVersion,
    idempotencyKey: identity,
    ...(context.session.csrf === undefined ? {} : { csrfToken: context.session.csrf }),
    ...(options.expectedVersion === undefined ? {} : { expectedVersion: options.expectedVersion }),
    ...(options.proof === undefined ? {} : { proof: options.proof }),
    ...(options.signal === undefined ? {} : { signal: options.signal }),
  });
}
