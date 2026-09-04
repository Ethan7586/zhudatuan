import { parseExperience } from '@shop/contract';
import type { WriteTransactionContext } from '../../../../foundation/persistence/TransactionContext';
import { PublishPolicy } from '../../domain/policy/PublishPolicy';
import type { PublicationRepository } from '../port/PublicationRepository';
import type { PublishableVersion, VersionRepository } from '../port/VersionRepository';
import { PublishEvidence } from '../../domain/value/PublishEvidence';

export class ExperienceValidator {
  constructor(
    private readonly versions: VersionRepository,
    private readonly publications: PublicationRepository,
    private readonly policy = new PublishPolicy()
  ) {}

  async validate(context: WriteTransactionContext, version: string, expectedVersion?: number): Promise<Readonly<{ candidate: PublishableVersion; issues: ReturnType<PublishPolicy['evaluate']> }>> {
    const candidate = await this.versions.candidate(context, version, expectedVersion);
    const document = parseExperience(candidate.configuration);
    const evidence = await this.publications.evidence(context, document, candidate.pool, candidate.mall);
    const issues = this.policy.evaluate(document, evidence);
    await this.versions.recordValidation(context, version, PublishEvidence.collect(evidence.dependencies, issues));
    return Object.freeze({ candidate, issues });
  }

  assertPublishable(issues: ReturnType<PublishPolicy['evaluate']>): void {
    this.policy.assertPublishable(issues);
  }
}
