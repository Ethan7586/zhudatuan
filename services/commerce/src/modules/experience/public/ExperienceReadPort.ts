import { publicPort } from '../../../bootstrap/ModuleRegistry';
import type { ReadTransactionContext } from '../../../foundation/persistence/TransactionContext';
import type { ExperienceDocument } from '@shop/contract';
export interface StorefrontEntry {
  readonly application: string;
  readonly handle: string;
  readonly url: string;
  readonly mall: string;
  readonly pool: string;
  readonly release: string;
  readonly version: string;
  readonly tenant: string;
  readonly contentHash: string;
  readonly objectKey: string;
}
export interface PublishedStorefront {
  readonly document: ExperienceDocument;
  readonly version: string;
  readonly asOf: string;
}
export type ExperienceChannel = 'web' | 'miniapp' | 'store';
export interface PublishedExperience extends PublishedStorefront {
  readonly application: string;
  readonly mall: string;
  readonly pool: string;
  readonly release: string;
  readonly hash: string;
  readonly objectKey: string;
  readonly effectiveAt: string;
  readonly channel: ExperienceChannel;
  readonly locale: string;
  readonly etag: string;
}
export interface ExperienceReadPort {
  resolveEntry(context: ReadTransactionContext, handle: string): Promise<StorefrontEntry>;
  published(context: ReadTransactionContext, entry: StorefrontEntry): Promise<PublishedStorefront>;
  publishedFor(context: ReadTransactionContext, input: Readonly<{ mall: string; channel: ExperienceChannel; locale: string }>): Promise<PublishedExperience | null>;
}
export const EXPERIENCE_READ_PORT = publicPort<ExperienceReadPort>('experience', 'read');
