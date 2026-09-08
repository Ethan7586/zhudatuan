import type { OperationInputFor, OperationOutputFor } from '@shop/contract';
import type { WriteHandlerContext } from '../../../../pipeline/HandlerContext';
import type { OperationHandler, OperationReply } from '../../../../pipeline/OperationHandler';
import { DomainError } from '../../../../platform/error/DomainError';
import { requireSession } from '../../../../platform/security/OperationSecurityContext';
import type { ReleaseRepository } from '../port/ReleaseRepository';
import type { VersionRepository } from '../port/VersionRepository';
import type { ExperienceValidator } from '../service/ExperienceValidator';

export class VersionsPublishHandler implements OperationHandler<'experience.versions.publish', 'write'> {
  readonly operation = 'experience.versions.publish' as const;
  readonly mode = 'write' as const;
  constructor(
    private readonly versions: VersionRepository,
    private readonly releases: ReleaseRepository,
    private readonly validator: ExperienceValidator
  ) {}
  async execute(input: OperationInputFor<'experience.versions.publish'>, context: WriteHandlerContext<'experience.versions.publish'>): Promise<OperationReply<OperationOutputFor<'experience.versions.publish'>>> {
    const access = requireSession(context.security);
    if (context.expectedVersion === undefined) throw new DomainError('EXPECTED_VERSION_REQUIRED');
    const validation = await this.validator.validate(context.transaction, input.path.versionid, context.expectedVersion);
    this.validator.assertPublishable(validation.issues);
    const version = validation.candidate;
    if (version.pool === null) throw new DomainError('EXPERIENCE_PUBLICATION_INVALID', { issues: validation.issues });
    await this.versions.freeze(context.transaction, input.path.versionid);
    const release = await this.releases.publish(context.transaction, { application: version.application, version: input.path.versionid, pool: version.pool, actor: access.actor.id, trace: context.traceId });
    return { status: 202, body: release as unknown as OperationOutputFor<'experience.versions.publish'> };
  }
}
