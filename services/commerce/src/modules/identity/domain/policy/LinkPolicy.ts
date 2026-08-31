import { DomainError } from '../../../../foundation/domain/DomainError';
export class LinkPolicy {
  assertRevocable(activeLinks: number): void {
    if (!Number.isSafeInteger(activeLinks) || activeLinks <= 1) throw new DomainError('FEDERATION_LINK_REQUIRED');
  }
  assertAlternative(activeCredentials: number): void {
    if (!Number.isSafeInteger(activeCredentials) || activeCredentials < 1) throw new DomainError('FEDERATION_LINK_REQUIRED');
  }
  assertNoAmbiguity(matches: number): void {
    if (matches !== 1) throw new DomainError(matches === 0 ? 'FEDERATION_LINK_REQUIRED' : 'FEDERATION_LINK_CONFLICT');
  }
}
