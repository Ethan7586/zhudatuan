import type { EntryState } from '../../domain/policy/EntryPolicy';
import type { ExperienceTheme } from '@shop/contract';

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
  readonly mallName: string | null;
  readonly brandName: string | null;
  readonly code: string;
  readonly publicSlug: string;
  readonly name: string;
  readonly status: 'draft' | 'active' | 'disabled';
  readonly version: number;
  readonly headSequence: number | null;
  readonly publishedSequence: number | null;
  readonly theme: ExperienceTheme | null;
  readonly domain: Readonly<{
    mode: 'platform' | 'custom' | 'unknown';
    address: string | null;
    state: 'ready' | 'pending' | 'invalid' | 'disabled' | 'unknown';
  }>;
  readonly entry: ApplicationEntry;
  readonly updatedAt: string;
}

export interface ApplicationDetail extends ApplicationSummary {
  readonly head: Readonly<Record<string, unknown>> | null;
  readonly published: Readonly<Record<string, unknown>> | null;
  readonly history: readonly Readonly<Record<string, unknown>>[];
}
