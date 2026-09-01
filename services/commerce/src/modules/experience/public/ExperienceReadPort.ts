import { publicPort } from '../../../bootstrap/ModuleRegistry';
import type { ReadTransactionContext } from '../../../foundation/persistence/TransactionContext';
export interface StorefrontBinding {
  readonly application: string;
  readonly mall: string;
  readonly pool: string;
  readonly release: string;
  readonly version: string;
  readonly tenant: string;
}
export interface PublishedStorefront {
  readonly document: Readonly<Record<string, unknown>>;
  readonly version: string;
  readonly asOf: string;
}
export interface ExperienceReadPort {
  resolveHost(context: ReadTransactionContext, host: string): Promise<StorefrontBinding>;
  published(context: ReadTransactionContext, binding: StorefrontBinding): Promise<PublishedStorefront>;
}
export const EXPERIENCE_READ_PORT = publicPort<ExperienceReadPort>('experience', 'read');
