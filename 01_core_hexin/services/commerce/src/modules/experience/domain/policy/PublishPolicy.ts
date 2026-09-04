import { DomainError } from '../../../../foundation/domain/DomainError';

export interface PublicationEvidence {
  readonly schema: boolean;
  readonly assets: boolean;
  readonly actions: boolean;
  readonly capabilities: boolean;
  readonly bindings: boolean;
  readonly preview: boolean;
}

export class PublishPolicy {
  assertPublishable(evidence: PublicationEvidence): void {
    const failed = Object.entries(evidence).filter(([, valid]) => !valid).map(([name]) => name);
    if (failed.length > 0) throw new DomainError('EXPERIENCE_PUBLICATION_INVALID', { failed });
  }
}
