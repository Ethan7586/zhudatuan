import type { EntryState } from '../../domain/policy/EntryPolicy';

export interface ApplicationEntry {
  readonly handle: string;
  readonly url: string;
  readonly state: EntryState;
  readonly releaseId?: string;
  readonly releaseVersion?: string;
  readonly contentHash?: string;
  readonly requestId?: string;
}

export interface ApplicationSummary {
  readonly id: string;
  readonly mallId: string;
  readonly code: string;
  readonly publicSlug: string;
  readonly name: string;
  readonly status: 'draft' | 'active' | 'disabled';
  readonly version: number;
  readonly headSequence: number | null;
  readonly publishedSequence: number | null;
  readonly entry: ApplicationEntry;
  readonly updatedAt: string;
}

export interface ApplicationDetail extends ApplicationSummary {
  readonly head: Readonly<Record<string, unknown>> | null;
  readonly published: Readonly<Record<string, unknown>> | null;
  readonly history: readonly Readonly<Record<string, unknown>>[];
}
