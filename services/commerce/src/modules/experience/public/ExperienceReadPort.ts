import { publicPort } from '../../../bootstrap/ModuleRegistry';
import type { ReadTransactionContext } from '../../../foundation/persistence/TransactionContext';
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
  readonly document: Readonly<Record<string, unknown>>;
  readonly version: string;
  readonly asOf: string;
}
export interface ExperienceReadPort {
  resolveEntry(context: ReadTransactionContext, handle: string): Promise<StorefrontEntry>;
  published(context: ReadTransactionContext, entry: StorefrontEntry): Promise<PublishedStorefront>;
}
export const EXPERIENCE_READ_PORT = publicPort<ExperienceReadPort>('experience', 'read');
