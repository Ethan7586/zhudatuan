export type EntryState = 'ready' | 'unpublished' | 'disabled' | 'invalid';

export interface EntryFacts {
  readonly applicationStatus: string;
  readonly release: string | null;
  readonly version: string | null;
  readonly validationState: string | null;
  readonly publicationState: string | null;
  readonly contentHash: string | null;
  readonly configurationHash: string | null;
  readonly objectKey: string | null;
  readonly pool: string | null;
}

export class EntryPolicy {
  decide(facts: EntryFacts): EntryState {
    if (facts.applicationStatus === 'disabled') return 'disabled';
    if (!facts.release) return 'unpublished';
    if (
      facts.applicationStatus !== 'active' ||
      !facts.version ||
      !facts.pool ||
      facts.validationState !== 'valid' ||
      facts.publicationState !== 'active' ||
      !facts.contentHash ||
      facts.contentHash !== facts.configurationHash ||
      !facts.objectKey
    ) {
      return 'invalid';
    }
    return 'ready';
  }
}
