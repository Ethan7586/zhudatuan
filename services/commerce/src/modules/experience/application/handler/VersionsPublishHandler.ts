import { parseExperience } from '@shop/contract';
import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../foundation/application/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../foundation/application/OperationHandler';
import { DomainError } from '../../../../foundation/domain/DomainError';
import { requireSession } from '../../../../foundation/security/OperationSecurityContext';
import { PublishPolicy } from '../../domain/policy/PublishPolicy';
import type { PublicationRepository } from '../port/PublicationRepository';
import type { ReleaseRepository } from '../port/ReleaseRepository';
import type { VersionRepository } from '../port/VersionRepository';

export class VersionsPublishHandler implements OperationHandler<'experience.versions.publish', 'write'> {
  readonly operation = 'experience.versions.publish' as const;
  readonly mode = 'write' as const;
  constructor(
    private readonly versions: VersionRepository,
    private readonly publications: PublicationRepository,
    private readonly releases: ReleaseRepository,
    private readonly policy = new PublishPolicy()
  ) {}
  async execute(input: OperationInputFor<'experience.versions.publish'>, context: WriteHandlerContext<'experience.versions.publish'>): Promise<OperationReply<OperationOutputFor<'experience.versions.publish'>>> {
    const access = requireSession(context.security);
    if (context.expectedVersion === undefined) throw new DomainError('EXPECTED_VERSION_REQUIRED');
    const version = await this.versions.publishable(context.transaction, input.path.versionid, context.expectedVersion);
    const document = parseExperience(version.configuration);
    const references = version.pool === null ? false : await this.publications.references(context.transaction, document, version.pool);
    this.policy.assertPublishable({
      schema: document.application === version.application,
      assets: !/(?:data:|javascript:|file:|blob:)/i.test(JSON.stringify(version.configuration)),
      actions: safeActions(document) && references,
      capabilities: true,
      bindings: version.pool !== null,
      preview: version.validation === 'valid',
    });
    if (version.pool === null) throw new DomainError('EXPERIENCE_PUBLICATION_INVALID', { failed: ['bindings'] });
    const release = await this.releases.publish(context.transaction, { application: version.application, version: input.path.versionid, pool: version.pool, actor: access.actor.id, trace: context.traceId });
    return { status: 202, body: release as unknown as OperationOutputFor<'experience.versions.publish'> };
  }
}

function safeActions(document: ReturnType<typeof parseExperience>): boolean {
  return document.pages.every((page) => page.blocks.every((block) => block.action === undefined || safeTarget(block.action.type, block.action.target)));
}

function safeTarget(type: string, target: string): boolean {
  if (type === 'link') return /^\/(?:page|pages)\/[a-z0-9/-]+(?:\?[a-z0-9&=_-]+)?$/i.test(target);
  return /^[a-zA-Z0-9:._-]{1,255}$/.test(target);
}
